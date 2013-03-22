isEmpty = (object) ->
  for foo of object
    return false
  true

export { isEmpty }