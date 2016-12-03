'use strict'

const { PubSub, SubscriptionManager } = require('graphql-subscriptions')
const schema = require('./schema')

const pubsub = new PubSub()
const subscriptionManager = new SubscriptionManager({
  schema,
  pubsub,
  setupFunctions: {
    // map of subscription names to channel names and filter functions
    // e.g. commentAdded: (options, args) => ({ commentAddedChannel: comment => comment.repository_name === args.repoFullName })
  },
})

exports.subscriptionManager = subscriptionManager
exports.pubsub = pubsub
