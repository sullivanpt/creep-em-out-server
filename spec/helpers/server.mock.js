/**
 * Shared functions for server integration, performance, and e2e testing
 */
'use strict'

const _ = require('lodash')
const https = require('https')
const request = require('supertest')
const cookiejar = require('cookiejar')
const cookie = require('cookie')
const { Client } = require('subscriptions-transport-ws')

const { appServer, websocketServer } = require('../../server')

exports.request = request
exports.Client = Client
exports.appServer = appServer
exports.websocketServer = websocketServer

/**
 * superagent plugin to copy supplied jwt, or session.jwt from cookie into Authorization header.
 * Example use session cookie: agent.get().use(serverMock.plugInSetMutationHeader())
 * Example use jwt string: agent.get().use(serverMock.plugInSetMutationHeader(jwt))
 */
exports.plugInSetMutationHeader = function plugInSetMutationHeader (jwt) {
  return (req) => {
    jwt = jwt || cookie.parse(req.cookies)['session.jwt']
    if (jwt) {
      req.set('Authorization', 'Bearer ' + jwt)
    }
    return req
  }
}

/**
 * Wrap the agent with some useful helpers to do things like:
 * - getCookieValue: grab a cookie value by name
 * - getSessionJwt: shorthand for getCookieValue('session.jwt')
 * - refreshSession: refresh session cookie by async call to '/api/refresh' as cb(err, agent)
 */
function addAgentHelpers (agent) {
  return _.extend(agent, {
    getCookieValue (cookieName) {
      let cookieData = agent.jar.getCookie(cookieName, cookiejar.CookieAccessInfo.All)
      return cookieData ? cookieData.value : undefined
    },
    getSessionJwt () { return agent.getCookieValue('session.jwt') },
    refreshSession (cb) {
      agent
        .get('/api/refresh')
        .end((err, res) => {
          if (err) return cb(err)
          if (res.status !== 200) return cb(new Error('session refresh failed'))
          cb()
        })
      return agent // Example: let agent = serverMock.newAgent().refreshSession(done)
    },
  })
}

/**
 * create a new connection to the server
 * session cookies are stored locally to this instance
 */
exports.newAgent = () => {
  return addAgentHelpers(request.agent(appServer))
}

/**
 * helper class for testing subscriptions
 * inspired by supertest and http://stackoverflow.com/a/15553045
 */
class SubscriptionsAgent {

  /**
   * Returns a URL, extracted from a server. From supertest.
   */
  static wsServerAddress (app, path = '') {
    if (typeof app === 'string') {
      return app + path
    }

    var addr = app.address()
    if (!addr) this._server = app.listen(0)

    let port = app.address().port
    let protocol = app instanceof https.Server ? 'wss' : 'ws'
    return protocol + '://127.0.0.1:' + port + path
  }

  /**
   * set a callback of the form Fn(subId, SubscriptionsAgent) for when a subscription is successfully created
   * chainable
   */
  onSubscribed (subscribed) {
    this.subscribed = subscribed
    return this // chainable
  }

  /**
   * open the web socket connection
   * chainable
   */
  connect () {
    // defer connecting the websocket until this method is explicitly called
    this.client = new Client(SubscriptionsAgent.wsServerAddress(websocketServer))

    // connection monitoring is not supported by subscriptions-transport-ws Client
    // See https://github.com/apollostack/graphql-subscriptions/pull/27
    // monkey-patch onmessage watcher
    // See http://colintoh.com/blog/lodash-10-javascript-utility-functions-stop-rewriting
    // subscriptions-transport-ws onmessage would have thrown an error if message wasn't pareable
    let onmessage = this.client.client.onmessage.bind(this.client)
    this.client.client.onmessage = (message) => {
      onmessage(message)
      let { type, id } = _.attempt(_.partial(JSON.parse, message.data))
      if (this.subscribed && type === 'subscription_success') {
        this.subscribed(id, this)
      }
    }

    return this // chainable
  }

  /**
   * register for a new subscription; connect must have been already called
   * handler has the form Fn(err, res, SubscriptionsAgent)
   * for convenience the new subscription ID is cached as subAgent.lastSubId
   * returns the new subscription ID
   */
  subscribe (options, handler) {
    this.lastSubId = this.client.subscribe(options, (err, res) => handler(err, res, this))
    return this.lastSubId
  }

  /**
   * remove all subscriptions and close the websocket (not implemented)
   */
  disconnect () {
    this.client.unsubscribeAll()
    this.client.client.close() // disconnecting is not directly supported by subscriptions-transport-ws Client
    return this // chainable
  }
}

/**
 * create a new subscriptions websocket connection to the server
 * TODO: session cookie support, using same cookie as newAgent
 */
exports.newSubscriptionsAgent = () => new SubscriptionsAgent()
