'use strict'

const Member = `
  type Member {
    handle: String,
    trackers: [String]
  }
`

exports.schema = [Member]
exports.resolvers = {
  Member: {},
}
