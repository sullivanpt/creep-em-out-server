'use strict'

const fs = require('fs')
const path = require('path')
const httpErrors = require('http-errors')
const express = require('express')
const compression = require('compression')
const favicon = require('serve-favicon')
const helmet = require('helmet')
const cookieParser = require('cookie-parser')
const bodyParser = require('body-parser')
const serveStatic = require('serve-static')
const morgan = require('morgan')

const { graphqlExpress, graphiqlExpress } = require('graphql-server-express')

const { createServer } = require('http')
const { SubscriptionServer } = require('subscriptions-transport-ws')
const { subscriptionManager } = require('./subscriptions')

const session = require('./session/session')
const schema = require('./schema')
const models = require('./models')

const publicRoot = path.normalize(path.resolve(__dirname, '../public'))
const PORT = process.env.PORT || 3000
const WS_PORT = process.env.WS_PORT || PORT
const ROOT_URL = process.env.ROOT_URL || `http://localhost:${PORT}`
const SESSION_SECRET = process.env.SESSION_SECRET || 'keyboard-cat'

// pull in repository and build data for logging as written by bin/git-describe
const version = JSON.parse(fs.readFileSync(path.join(publicRoot, 'version.json')))

// test route response (designed to be safe in production)
function jsonCredentialsResponseHandler (req, res) {
  res.json({
    mutation: req.session.mutation,
    tracker: req.session.sub,
    handle: req.member.handle,
    rtm: (new Date()).toISOString(),
  })
}

var app = express()

// log HTTP requests, configure some best practices, serve some default content
// trust X-Forwarded-* headers from our load balancer
app.enable('trust proxy')
app.use(helmet())
app.use(compression())

// serve up the static content unprotected and untracked (no session management)
app.use(favicon(path.join(publicRoot, 'favicon.ico')))
app.use(serveStatic(publicRoot))

// log all routes after this path (the non-static routes)
app.use(morgan('dev'))

// note: noCache prevents IE and Safari from caching any AJAX responses
// note: etag caching and 304s cause AJAX content issues on every browser except Chrome
app.disable('etag')
app.use(helmet.noCache())

// end point for feature testing (note: designed to be safe in production)
app.route('/test/error').get((req, res, next) => { next(httpErrors(400, 'error test point')) })

// all routes after this path require session tracking using cookies.
// the following creates a token to be returned the user agent as a cookie, if one doesn't exist.
// it is vulnerable to CSRF so only use it to authenticate nulli-potent routes (GET).
// note: technically "refresh" is a mutation, but it is limited in scope.
// associateAndRefresh adds req.session
// we add req.member
app.use(cookieParser())
app.use(session.routeAssociateAndRefresh({
  iss: ROOT_URL,
  secret: SESSION_SECRET,
  refreshMaxAge: 365 * 24 * 60 * 60 * 1000, // 1 year (i.e. forever, longer tracks the user agent longer)
  sessionMaxAge: 5 * 60 * 1000, // 5 minutes (shorter is better except server needs to see it before it expires)
  sessionEarlyRefresh: 1 * 60 * 1000, // 1 minute (should be shorter than sessionMaxAge)
  refreshSub: (req, prevSub) =>
    models.Member.findByTracker(prevSub)
      .then(member => {
        // lookup existing tracker. if it's null or purposely expired returned member will be null
        if (member) {
          console.log(`returning tracker ${prevSub} as handle ${member.handle}`)
          return [ prevSub, member ]
        } else {
          // generate a short string that humans can use to help track a user on the site and in logs
          let sub = models.Member.generateTracker()
          console.log(`new tracker ${sub}`)
          // create a new member here and associate with the new tracker
          return Promise.all([ sub, models.Member.insert(sub) ]) // force member promise to resolve
        }
      })
      .then(values => {
        req.member = values[1] // attach the member to the request
        return values[0] // returns prevSub or new sub back to session findSub
      })
}))

// these paths are effectively no-ops to allow web agent and AJAX session refresh
// TODO: consider option to only refresh session on these routes to simplify non browser jwt handling
app.route('/').get((req, res, next) => {
  res.sendFile(path.join(publicRoot, 'templates/index.html'))
})
app.route('/api/refresh').get(jsonCredentialsResponseHandler)

// interactive graphQL exploration (note: this just puts up the UI, data requests are sent to our endpoint below)
app.use('/graphiql', graphiqlExpress({
  endpointURL: '/graphql',
  query: `{
  articles (authorHandle: "") {
    text,
    author {
      handle
    }
  }
}`,
  // copy session.jwt cookie to header of GraphiQL requests for routeAuthenticateForMutation
  // See http://dev.apollodata.com/tools/graphql-server/graphiql.html and http://stackoverflow.com/a/25490531
  passHeader: "'Authorization': 'Bearer ' + (document.cookie.match('(^|;)\\s*session.jwt\\s*=\\s*([^;]+)') || []).pop()",
}))

// TODO: authenticate for sensitive routes and route handlers for same

// all routes after this path require session tracking using double submit pattern on Authorization header
// we are much less vulnerable to CSRF so we can do mutations (POST, PUT, DELETE).
app.use(session.routeAuthenticateForMutation({
  iss: ROOT_URL,
  secret: SESSION_SECRET,
}))

// TODO: optionally update tracker's saved req.ip, userAgent, etc.

// end point for feature testing (note: designed to be safe in production)
app.route('/test/mutation').get(jsonCredentialsResponseHandler)

// the primary API route
app.use('/graphql', bodyParser.json(), graphqlExpress((req) => {
  return {
    schema,
    context: {
      member: req.member,
      models,
    }
  }
}))

// error handlers must be last routes defined
// in development mode we can pretty print any uncaught errors
if (app.get('env') === 'development') {
  app.use(require('errorhandler')())
}

// start the server
let appServer = app.listen(PORT, () => console.log(
  `API Server build ${version.raw} is now running on http://localhost:${PORT}`
))

// by default use the app server for WebSocket server for subscriptions too
// however, if WS_PORT differs then create a unique WebSocket server.
// Aside two servers complicates session cookie management, but we don't use cookies on the webSocket anyway to avoid CSRF
let websocketServer = appServer
if (WS_PORT !== PORT) {
  websocketServer = createServer((req, res) => {
    res.writeHead(404)
    res.end()
  })

  websocketServer.listen(WS_PORT, () => console.log(
    `Websocket Server is now running on http://localhost:${WS_PORT}`
  ))
}

var subscriptions = new SubscriptionServer({
  subscriptionManager,

  // the obSubscribe function is called for every new subscription
  // and we use it to set the GraphQL context for this subscription
  // note: onSubscribe can be async and return a promise
  // use CSRF tokens instead of cookies http://www.christian-schneider.net/CrossSiteWebSocketHijacking.html
  // review https://www.owasp.org/index.php/HTML5_Security_Cheat_Sheet
  onSubscribe: (msg, params, wsReq) => {
    console.info('subscription request')
    return session.promiseAuthenticateForMutation({
      iss: ROOT_URL,
      secret: SESSION_SECRET,
      jwtSession: params.variables.jwtSession,
      wsReq, // optional, if present can be used for additional authentication
    })
      .then(sub => {
        return models.Member.findByTracker(sub)
          .then(member => {
            if (!member) {
              return Promise.reject(httpErrors(401, 'tracker revoked'))
            }
            console.info(`subscription for tracker ${sub} as handle ${member.handle}`)
            return Object.assign({}, params, {
              context: {
                member,
                models,
              },
            })
          })
      })
  },
}, websocketServer)

// expose app (useful for integration and e2e testing)
exports.app = app
exports.appServer = appServer
exports.websocketServer = websocketServer
exports.subscriptions = subscriptions
