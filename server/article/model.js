'use strict'

const { pubsub } = require('../subscriptions')

// TODO: replace this memory object with a DB
let articles = []

class Article {
  constructor (text, author) {
    this.text = text
    this.author = author
  }

  static insert (data, author) {
    // TODO: any validations on data, rate limiting, etc.
    let result = new Article(data.text, author)
    articles.push(result)
    console.info(`New article by member ${author.handle}`)
    pubsub.publish('articleAdded', result)
    return Promise.resolve(result)
  }

  static findByAuthor (author) {
    let result = articles.filter(article => (!author || article.author === author))
    return Promise.resolve(result)
  }
}

exports.Article = Article
