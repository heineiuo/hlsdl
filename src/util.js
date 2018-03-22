const { Readable } = require('readable-stream')
const fs = require('fs')
const { promisify } = require('util')

class StringStream extends Readable {
  constructor(str) {
    super()
    if (!(this instanceof StringStream)) return new StringStream(str)
    Readable.call(this)
    this._str = str
  }

  _read = () => {
    if (!this.ended) {
      var self = this
      process.nextTick(function () {
        self.push(new Buffer(self._str))
        self.push(null)
      })
      this.ended = true
    }
  }
}

export const concatTS = async ({ list, outputFile }) => {
  const writeStream = fs.createWriteStream(outputFile)
  const len = list.length
  const readFile = promisify(fs.readFile)
  const walk = async (index) => {
    if (index === len) return writeStream.end()
    writeStream.write(await readFile(list[index]))
    return await walk(index + 1)
  }
  return await walk(0)
}

export const createReadStreamFromString = (str) => {
  return new StringStream(str)
}