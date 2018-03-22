import m3u8 from 'm3u8'
import fs from 'fs'
import path from 'path'
import fetch from 'node-fetch'
import { argv } from 'yargs'
import url from 'url'
import { promisify } from 'util'
import EventEmitter from 'events'
import { createReadStreamFromString, concatTS } from './util'

const getM3U8Content = async ({ urlAddress }) => {
  const urlObject = url.parse(urlAddress)
  const res = await fetch(urlAddress)
  return await res.text()
}

const getDownloadList = ({ prefix, content }) => new Promise(async (resolve, reject) => {
  const parser = m3u8.createStream()

  // parser.on('item', function(item) {
  //   console.log(item)
  //   // emits PlaylistItem, MediaItem, StreamItem, and IframeStreamItem
  // })

  parser.on('m3u', (m3u) => {
    // fully parsed m3u file
    // console.log(m3u)
    const downloadList = []
    m3u.items.PlaylistItem.forEach(item => {
      downloadList.push(`${prefix}/${item.properties.uri}`)
    })

    resolve(downloadList)
  })

  createReadStreamFromString(content).pipe(parser)

})

const queueDownloadStream = ({ list }) => {
  const emitter = new EventEmitter()
  let index = 0
  let len = list.length
  const walk = async () => {
    if (index === len) emitter.emit('end')
    try {
      const res = await fetch(list[index])
      const ab = await res.arrayBuffer()
      const buf = Buffer.from(ab)
      emitter.emit('data', buf)
      index++
      walk()
    } catch (e) {
      emitter.emit('error', e)
    }
  }
  process.nextTick(walk)
  return emitter
}

const dl = ({ urlAddress, output }) => new Promise(async (resolve, reject) => {
  try {
    const urlObject = url.parse(urlAddress)
    const content = await getM3U8Content({
      urlAddress: urlAddress
    })
    const downloadList = await getDownloadList({
      prefix: path.dirname(urlAddress),
      content
    })

    const ws = fs.createWriteStream(path.resolve(process.cwd(), output))
    const queueStream = queueDownloadStream({ list: downloadList })
    queueStream.on('data', buf => {
      ws.write(buf)
    })

    queueStream.on('end', () => {
      ws.end()
      resolve()
    })

    queueStream.on('error', (e) => {
      reject(e)
    })
  } catch (e) {
    reject(e)
  }

})

export default dl

