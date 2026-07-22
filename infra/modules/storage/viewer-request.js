function handler(event) {
  var request = event.request;
  var uri = request.uri;

  if (uri === "/") {
    var language = request.headers["accept-language"]
      ? request.headers["accept-language"].value.toLowerCase()
      : "";
    var locale = language.indexOf("pt") === 0
      ? "pt-BR"
      : language.indexOf("en") === 0
        ? "en"
        : "es";

    return {
      statusCode: 302,
      statusDescription: "Found",
      headers: { location: { value: "/" + locale + "/login" } }
    };
  }

  var localizedRoute = uri.match(/^\/(es|en|pt-BR)(\/.*)?$/);
  if (!localizedRoute) {
    return request;
  }

  var lastSegment = uri.substring(uri.lastIndexOf("/") + 1);
  if (lastSegment.indexOf(".") === -1) {
    request.uri = "/" + localizedRoute[1] + "/index.html";
  }

  return request;
}
