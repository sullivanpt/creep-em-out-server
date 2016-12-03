'use strict'

// TODO: replace this memory object with a DB
let trackerToMember = new Map()

class Member {
  constructor (handle, tracker) {
    this.handle = handle // the first tracker (could be trackers[0])
    this.trackers = tracker ? [tracker] : []
  }

  static getByHandle (handle) {
    let member = trackerToMember.get(handle)
    return Promise.resolve(member)
  }

  static findOrInsertByTracker (tracker) {
    let member = trackerToMember.get(tracker)
    if (!member) {
      member = new Member(tracker, tracker)
      trackerToMember.set(tracker, member)
      console.info(`New member ${member.handle}`)
    }
    return Promise.resolve(member)
  }
}

exports.Member = Member
