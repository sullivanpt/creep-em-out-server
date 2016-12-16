'use strict'

const Article = `
  type Article {
    topicId: String,
    text: String,
    author: Member
  }
`

exports.schema = [Article]
exports.resolvers = {
  Article: {
    topicId (article) { return article.topic.id },
  },
}
