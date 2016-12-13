'use strict'

// TODO: replace this memory object with a DB
let trackerToMember = new Map()

class Member {
  constructor (handle, tracker) {
    this.handle = handle // the first tracker (could be trackers[0])
    this.trackers = tracker ? [tracker] : []
  }

  claimTracker (tracker) {
    // TODO: do we need to ensure it's not already claimed or already a member of trackers?
    // note: the old member still has a reference to this tracker, but this tracker references the new member
    this.trackers.push(tracker)
    trackerToMember.set(tracker, this)
  }

  /**
   * generate a short but statistically probably unique ID string. See http://stackoverflow.com/a/8084248
   */
  static generateTracker () {
    return (Math.random() + 1).toString(36).substr(2, 5)
  }

  static insert (tracker, handle) {
    // TODO: error if exists: let member = trackerToMember.get(tracker)
    let member = new Member(handle || Member.generateTracker(), tracker)
    trackerToMember.set(member.handle, member)
    trackerToMember.set(tracker, member)
    console.info(`insert handle ${member.handle} with tracker ${tracker}`)
    return Promise.resolve(member)
  }

  static getByHandle (handle) {
    let member = trackerToMember.get(handle)
    console.info('getByHandle %s %s', handle, !!member)
    return Promise.resolve(member)
  }

  static findByTracker (tracker) {
    let member = trackerToMember.get(tracker)
    console.info('findByTracker %s is handle %s', tracker, member && member.handle)
    return Promise.resolve(member)
  }

  static blackListTracker (tracker) {
    console.info('blackListTracker %s', tracker)
    trackerToMember.delete(tracker)
  }
}

exports.Member = Member
