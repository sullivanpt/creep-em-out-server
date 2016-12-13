'use strict'

const models = require('../../server/models')

exports.models = models

exports.newMember = (trackerAndHandle) => models.Member.insert(trackerAndHandle || models.Member.generateTracker(), trackerAndHandle)
exports.newArticle = (member, text) => models.Article.insert({ text: text || `message by ${member.handle}` }, member)
