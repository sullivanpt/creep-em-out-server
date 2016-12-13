'use strict'

const serverMock = require('../helpers/server.mock.js')

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
      .get('/api/refresh')
      .expect(200)
      .expect('set-cookie', /refresh.jwt=/)
      .expect('set-cookie', /session.jwt=/)
      .end((err, res) => {
        expect(err).toBeFalsy()
        expect(res.body.tracker).toBeTruthy()
        tracker = res.body.tracker
        done()
      })
  })

  it('should keep session cookie and tracker on subsequent API access', (done) => {
    agent
      .get('/api/refresh')
      .expect(200)
      .end((err, res) => {
        expect(err).toBeFalsy()
        expect(res.headers['set-cookie']).toBeFalsy()
        expect(res.body.tracker).toEqual(tracker)
        done()
      })
  })

  it('should reject request when tracker not in CSRF header on mutation API access', (done) => {
    agent
      .get('/test/mutation')
      .expect(403)
      .end((err, res) => {
        expect(res.headers['set-cookie']).toBeFalsy()
        expect(err).toBeTruthy()
        done()
      })
  })

  it('should accept request when tracker is in CSRF header on mutation API access', (done) => {
    agent
      .get('/test/mutation')
      .use(serverMock.plugInSetMutationHeader())
      .expect(200)
      .end((err, res) => {
        expect(err).toBeFalsy()
        expect(res.headers['set-cookie']).toBeFalsy()
        expect(res.body.tracker).toEqual(tracker)
        done()
      })
  })

  it('should support serverMock refreshSession syntax', (done) => {
    let agent = serverMock.newAgent().refreshSession(err => {
      expect(err).toBeFalsy()
      agent
        .get('/test/mutation')
        .use(serverMock.plugInSetMutationHeader())
        .expect(200)
        .end((err, res) => {
          expect(err).toBeFalsy()
          done()
        })
    })
  })
})
