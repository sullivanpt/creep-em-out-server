'use strict'

/**
 * generate a short but statistically probably unique ID. See http://stackoverflow.com/a/8084248
 */
function generateTracker () {
  return (Math.random() + 1).toString(36).substr(2, 5)
}

exports.generateTracker = generateTracker
