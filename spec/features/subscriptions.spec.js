'use strict'

const serverMock = require('../helpers/server.mock.js')
const modelsMock = require('../helpers/models.mock.js')

describe('subscriptions startup', () => {
  it('should receive subscription events over a websocket', (done) => {
    let query = `
subscription onArticleAdded {
  articleAdded {
    text,
    author {
      handle
    }
  }
}`

    serverMock.newSubscriptionsAgent()
      .onSubscribed((subId, subAgent) => {
        expect(subId).toEqual(subAgent.lastSubId)

        // generate articleAdded event for the subscription
        modelsMock.newMember('abcde')
          .then(member => modelsMock.newArticle(member))
      })
      .connect()
      .subscribe({ query }, (err, res, subAgent) => {
        expect(err).toBeFalsy()
        expect(res).toEqual({
          articleAdded: {
            text: 'message by abcde',
            author: { handle: 'abcde' }
          }
        })
        subAgent.disconnect()
        done()
      })
  })
})
