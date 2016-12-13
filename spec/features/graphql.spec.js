'use strict'

const serverMock = require('../helpers/server.mock.js')
const modelsMock = require('../helpers/models.mock.js')

describe('GraphQL endpoint', () => {
  it('should accept queries', (done) => {
    // formatted query for the test
    let query = `{
  articles (authorHandle: "abcef") {
    text,
    author {
      handle
    }
  }
}`

    // generate article for the test
    modelsMock.newMember('abcef')
      .then(member => modelsMock.newArticle(member))
      .then(() => {
        // retrieve the article
        let agent = serverMock.newAgent().refreshSession(err => {
          expect(err).toBeFalsy()
          agent
            .post('/graphql')
            .use(serverMock.plugInSetMutationHeader())
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
  })
})
