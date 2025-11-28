// Name:        app.js
// Description: simple node.js and express app

// This imports the Express.js module into the application.
// E.g., "Hey, I need Express.js for my app." 
// Express.js is a handy tool for building web apps with Node.js, which makes life a lot easier. 
var express = require('express');

// Initialize express by instantiating it and assign a variable 
// Called 'app' to it
// Useful for doing web stuff like routing HTTP requests, setting up middleware, and showing HTML views.
var app = express();

// Root Route
// A handler for when someone tries to access the homepage ('/') of the app. 
app.get('/', function (req, res) {
  console.log("in app.js.  The root route has been hit ...")
  res.status(200)
  res.send('Hello World - from my new SurfaceSense node.js express app!');
});

// About Route
// A handler for when someone tries to access the homepage ('/about') of the app. 
app.get('/about', function (req, res) {
  console.log("in app.js.  The root route has been hit ...")
  res.status(200)
  res.send('About Page');
});

// App listens on Port 8000 for requests
// Like opening the doors of the app and saying "Alright, we're ready for business on port 8000!". 
// The function that's passed in runs once the app is ready to start taking requests. 
// If something goes wrong starting the server, it'll log an error message. 
// If everything's good, it'll log a success message.
app.listen(8000, function (err) {
  if (err) console.log("Error starting server.  Msg: " + err)
  console.log('Node.js and Express app listening on port 8000!');
});