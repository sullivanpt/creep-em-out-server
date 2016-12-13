'use strict'

const Article = `
  type Article {
    text: String,
    author: Member
  }
`

exports.schema = [Article]
exports.resolvers = {
  Article: {},
}
