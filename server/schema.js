'use strict'

const { merge } = require('lodash')
const { makeExecutableSchema } = require('graphql-tools')

const { schema: articleSchema, resolvers: articleResolvers } = require('./documents/article.schema')
const { schema: memberSchema, resolvers: memberResolvers } = require('./documents/member.schema')
const { schema: topicSchema, resolvers: topicResolvers } = require('./documents/topic.schema')

const RootQuery = `
  type RootQuery {
    # Lookup a member by name
    member(handle: String): Member

    # Return the currently logged in user, or null if nobody is logged in
    currentMember: Member

    # Retrieve Topics
    topics: [Topic]

    # Retrieve Articles
    articles(authorHandle: String, topicId: String): [Article]
  }
`

const RootSubscription = `
  type RootSubscription {
    # Subscription fires on every article added
    articleAdded: Article
  }
`

const SchemaDefinition = `
  schema {
    query: RootQuery
    subscription: RootSubscription
  }
`

const rootResolvers = {
  RootQuery: {
    member (root, { handle }, context) {
      return context.models.Member.getByHandle(handle)
    },
    currentMember (root, args, context) {
      return context.member || null
    },
    topics (root, args, context) {
      return context.models.Topic.find()
    },
    articles (root, { authorHandle, topicId }, context) {
      return context.models.Member.getByHandle(authorHandle)
        .then(author => context.models.Article.findByAuthor(author, topicId))
    },
  },
  RootSubscription: {
    articleAdded (article) {
      return article // the subscription payload is the article
    },
  },
}

// Put schema together into one array of schema strings
// and one map of resolvers, like makeExecutableSchema expects
const schema = [SchemaDefinition, RootQuery, RootSubscription, ...articleSchema, ...memberSchema, ...topicSchema]
const resolvers = merge(rootResolvers, articleResolvers, memberResolvers, topicResolvers)

const executableSchema = makeExecutableSchema({
  typeDefs: schema,
  resolvers: resolvers,
})

module.exports = executableSchema
