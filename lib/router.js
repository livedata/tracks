exports.render = render
exports._mapRoute = mapRoute

var qs = require('qs')

function mapRoute(from, params) {
  var i, path, queryString, url
  url = params.url
  queryString = ~(i = url.indexOf('?')) ? url.slice(i) : ''
  i = 0
  path = from.replace(/(?:(?:\:([^?\/:*]+))|\*)\??/g, function(match, key) {
    if (key) {
      return params[key]
    }
    return params[i++]
  })
  return path + queryString
}

function cancelRender(url, form, e) {
  if (e) return
  if (form) {
    form._forceSubmit = true
    return form.submit()
  } else {
    return window.location = url
  }
}

function render(page, options, e) {
  var routes = page._routes
    , url = options.url.replace(/#.*/, '')
    , querySplit = url.split('?')
    , path = querySplit[0]
    , queryString = querySplit[1]
    , query = queryString ? qs.parse(queryString) : {}
    , method = options.method
    , body = options.body || {}
    , previous = options.previous
    , form = options.form
    , transitional = routes.transitional[method]
    , queue = routes.queue[method]

  function reroute(url) {
    var path = url.replace(/\?.*/, '')
    renderQueued(previous, path, url, form, null, onMatch, transitional, queue, 0)
  }

  function onMatch(path, url, i, route, renderNext, noPage) {
    if (e) e.preventDefault()

    var routeParams = route.params
      , params = routeParams.slice()
      , runPage = noPage ? null : page
      , key
    for (key in routeParams) {
      params[key] = routeParams[key]
    }
    params.url = url
    params.body = body
    params.query = query

    function next(err) {
      if (err != null) return cancelRender(url, form)
      renderNext(previous, path, url, form, null, onMatch, transitional, queue, i)
    }

    try {
      run(route, runPage, params, next, reroute)
    } catch (err) {
      cancelRender(url, form)
    }
  }
  return renderTransitional(previous, path, url, form, e, onMatch, transitional, queue, 0)
}

function run(route, page, params, next, reroute) {
  var callbacks = route.callbacks
    , onRoute = callbacks.onRoute

  if (callbacks.forward) {
    var render = page.render
    page.render = function() {
      onRoute(callbacks.forward, null, params, next)
      page.render = render
      render.apply(page, arguments)
    }
    return reroute(mapRoute(callbacks.from, params))
  }
  onRoute(callbacks.callback, page, params, next)
}

function renderTransitional(previous, path, url, form, e, onMatch, transitional, queue, i) {
  var item
  while (item = transitional[i++]) {
    if (!item.to.match(path)) continue
    if (!item.from.match(previous)) continue
    return onMatch(path, url, i, item.to, renderTransitional, true)
  }
  return renderQueued(previous, path, url, form, e, onMatch, transitional, queue, 0)
}

function renderQueued(previous, path, url, form, e, onMatch, transitional, queue, i) {
  var route
  while (route = queue[i++]) {
    if (!route.match(path)) continue
    return onMatch(path, url, i, route, renderQueued)
  }
  return cancelRender(url, form, e)
}