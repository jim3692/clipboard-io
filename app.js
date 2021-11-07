const path = require('path')

const fastify = require('fastify')
const fastifyFormBody = require('fastify-formbody')
const fastifyIO = require('fastify-socket.io')
const fastifyStatic = require('fastify-static')

const { Subject } = require('rxjs')

const server = fastify()

server.register(fastifyFormBody)
server.register(fastifyIO)
server.register(fastifyStatic, {
  root: path.join(__dirname, 'static'),
  prefix: '/static/'
})

const pemSubjects = {}

server.get('/', (req, reply) => {
  return reply.sendFile('qr.html')
})

server.get('/submit', (req, reply) => {
  return reply
    .code(200)
    .sendFile('send.html')
})

server.get('/submit/:id', (req, reply) => {
  const id = req.params.id
  const subject = new Subject()

  subject.subscribe((pem) => {
    reply.redirect(`/submit?id=${id}&pem=${pem}`)
    subject.unsubscribe()
    delete pemSubjects[id]
  })

  pemSubjects[id] = subject
  server.io.to(id).emit('get-public-pem')
})

server.post('/submit/:id', (req, reply) => {
  Promise.resolve()
    .then(() => server.io.to(req.params.id).emit('data', req.body.data))
  return true
})

server.ready((err) => {
  if (err) throw err

  server.io.on('connection', (socket) => {
    socket.on('public-pem', (pem) => pemSubjects[socket.id]?.next(pem))
  })
})

server.listen(3000, '0.0.0.0')
