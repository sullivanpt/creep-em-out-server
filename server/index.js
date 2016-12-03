'use strict'

const fs = require('fs')
const path = require('path')
const express = require('express')
const compression = require('compression')
const favicon = require('serve-favicon')
const helmet = require('helmet')
const bodyParser = require('body-parser')
const serveStatic = require('serve-static')
const morgan = require('morgan')
const session = require('express-session')

const { graphqlExpress, graphiqlExpress } = require('graphql-server-express')

const { createServer } = require('http')
const { SubscriptionServer } = require('subscriptions-transport-ws')
const { subscriptionManager } = require('./subscriptions')

const schema = require('./schema')
const { generateTracker } = require('./tracker/model')
const models = require('./models')

const publicRoot = path.normalize(path.resolve(__dirname, '../public'))
const PORT = process.env.PORT || 3000
const WS_PORT = process.env.WS_PORT || 8080
const SESSION_SECRET = process.env.SESSION_SECRET || 'keyboard-cat'

// pull in repository and build data for logging as written by bin/git-describe
const version = JSON.parse(fs.readFileSync(path.join(publicRoot, 'version.json')))

var app = express()

// log HTTP requests, configure some best practices, serve some default content
// trust X-Forwarded-* headers from our load balancer
app.enable('trust proxy', 1)
app.use(compression())
app.use(favicon(path.join(publicRoot, 'favicon.ico')))
app.use(morgan('dev'))
app.disable('etag')
app.use(helmet({ noCache: true }))
app.use(serveStatic(publicRoot))

// session tracking using cookies
// TODO: session store
// FUTURE: opt-in support for persistent cookies
app.use(session({
  name: 'connect.sid', // RFC6265 compliant name. https://github.com/expressjs/cookie-session/issues/16
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cooke: {
    // note: setting maxAge here does not work, despite documentation to the contrary
    secure: 'auto'
  }
}))

// we always try to pin the user to a session
// we also generate a short string that humas can use to help track a user on the site and in logs
app.use((req, res, next) => {
  if (!req.session.tracker) {
    req.session.tracker = generateTracker()
    req.session.cookie.maxAge = 365 * 24 * 60 * 60 * 1000 // 1 year (i.e. forever)
    console.log(`New session ${req.session.tracker}`)
  }

  // create a new member here as needed
  models.Member.findOrInsertByTracker(req.session.tracker)
    .then(member => {
      req.member = member
      next()
    }, reason => {
      next(new Error(reason))
    })
})

// note: noCache prevents IE and Safari from caching any AJAX responses
// note: etag caching and 304s cause AJAX content issues on every browser except Chrome
app.disable('etag')
app.use(helmet.noCache())

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

// interactive graphQL exploration
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
}))

// end points for feature testing (note: designed to be safe in production)
app.route('/test/ping').get((req, res) => { res.send({ tracker: req.session.tracker, pong: (new Date()).toISOString() }) })
app.route('/test/error').get((req, res, next) => { next(new Error('error test point')) })

// error handlers must be last routes defined
// in development mode we can pretty print any uncaught errors
if (app.get('env') === 'development') {
  app.use(require('errorhandler')())
}

// start the server
let appServer = app.listen(PORT, () => console.log(
  `API Server build ${version.raw} is now running on http://localhost:${PORT}`
))

// WebSocket server for subscriptions
// TODO: investigate why we need a separate server for ws connections. it complicates session cookie management
const websocketServer = createServer((req, res) => {
  res.writeHead(404)
  res.end()
})

websocketServer.listen(WS_PORT, () => console.log(
  `Websocket Server is now running on http://localhost:${WS_PORT}`
))

var subscriptions = new SubscriptionServer(
  {
    subscriptionManager,

    // the obSubscribe function is called for every new subscription
    // and we use it to set the GraphQL context for this subscription
    onSubscribe: (msg, params) => {
      console.info('New subscription')
      return Object.assign({}, params, {
        context: {
          // TODO: attach current member
          models,
        },
      })
    },
  },
  websocketServer
)

// expose app (useful for integration and e2e testing)
exports.app = app
exports.appServer = appServer
exports.websocketServer = websocketServer
exports.subscriptions = subscriptions
