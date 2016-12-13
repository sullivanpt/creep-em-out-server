'use strict'

const serverMock = require('../helpers/server.mock.js')

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
