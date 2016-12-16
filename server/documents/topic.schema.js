'use strict'

const Topic = `
  type Topic {
    id: String,
    title: String,
    description: String
  }
`

exports.schema = [Topic]
exports.resolvers = {
  Topic: {},
}
