/**
 * Some mock seed data for developing the server against
 */
'use strict'

const _ = require('lodash')
const models = require('../server/models')

console.log('Seeding models with sample data')

/**
 * Create mock text for article
 */
function mockText () {
  return _.times(8, models.Member.generateTracker).join(' ')
}

/**
 * Create a few members and articles
 */
_.times(3, () => {
  models.Member.insert(models.Member.generateTracker())
    .then(member => {
      models.Article.insert({ text: mockText() }, member)
    })
})
