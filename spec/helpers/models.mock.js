'use strict'

const { generateTracker } = require('../../server/tracker/model')
const models = require('../../server/models')

exports.models = models

exports.newMember = (tracker) => models.Member.findOrInsertByTracker(tracker || generateTracker())
exports.newArticle = (member, text) => models.Article.insert({ text: text || `message by ${member.handle}` }, member)
