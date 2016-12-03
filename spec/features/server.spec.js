'use strict'

const serverMock = require('../helpers/server.mock.js')
const modelsMock = require('../helpers/models.mock.js')

describe('server startup', () => {
  it('should return static content', (done) => {
    serverMock.newAgent()
      .get('/')
      .expect('Content-Type', /html/)
      .expect(200, (err, res) => {
        expect(err).toBeFalsy()
        expect(res.text).toContain('Kilroy was here')
        done()
      })
  })
})

describe('session tracking', () => {
  var agent = serverMock.newAgent() // this instance keeps the cookie
  var tracker

  it('should not set session cookie for static content', (done) => {
    agent
      .get('/version.json')
      .expect(200)
      .end((err, res) => {
        expect(err).toBeFalsy()
        expect(res.headers['set-cookie']).toBeFalsy()
        done()
      })
  })

  it('should set session cookie and tracker on first API access', (done) => {
    agent
      .get('/test/ping')
      .expect(200)
      .expect('set-cookie', /connect.sid=.*/)
      .end((err, res) => {
        expect(err).toBeFalsy()
        expect(res.body.tracker).toBeTruthy()
        tracker = res.body.tracker
        done()
      })
  })

  it('should keep session cookie and tracker on subsequent API access', (done) => {
    agent
      .get('/test/ping')
      .expect(200)
      .end((err, res) => {
        expect(err).toBeFalsy()
        expect(res.headers['set-cookie']).toBeFalsy()
        expect(res.body.tracker).toEqual(tracker)
        done()
      })
  })
})

describe('GraphQL endpoint', () => {
  it('should accept queries', (done) => {
    // generate article for the test
    modelsMock.newMember('abcef')
      .then(member => modelsMock.newArticle(member))

    let query = `{
  articles (authorHandle: "abcef") {
    text,
    author {
      handle
    }
  }
}`

    serverMock.newAgent()
      .post('/graphql')
      .send({ query })
      .expect(200)
      .end((err, res) => {
        expect(err).toBeFalsy()
        expect(res.body).toEqual({
          data: {
            articles: [{
              text: 'message by abcef',
              author: { handle: 'abcef' }
            }]
          }
        })
        done()
      })
  })
})
