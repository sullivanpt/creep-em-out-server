'use strict'

const models = require('../../server/models')

exports.models = models

let topic = models.Topic.getById('flame')

exports.newMember = (trackerAndHandle) => models.Member.insert(trackerAndHandle || models.Member.generateTracker(), trackerAndHandle)
exports.newArticle = (member, text) => models.Article.insert(topic, { text: text || `message by ${member.handle}` }, member)
