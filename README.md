# eero-js-api
JavaScript api for [eero](https://eero.com/) home mesh networks

This is an api for use with node or any other javascript platform to give access to the [eero](https://eero.com/) API. It is based on [eero-client from 343max](https://github.com/343max/eero-client) which does this in python. The *sample.js* cli lets you play with the api and see what the results look like. It also demonstrates how to use it.

## Cookies

Eero does not authenticate with simple user/password but rather through sending and receiving of tokens via text messages. That means, any application will need to negotiate with the api to receive a token. I've taken care of this behind the scenes by storing the results in a global cookie file. That may not be the most robust way of handling storage of the token but this was a quick first pass.

The cookie file is stored in /tmp an you can find the full name of the cookie file in the code. You will need to go through the login sequence to pass in your phone number and then enter the received code. The *sample.js* walks you through it but with a standalone app such as an IOT device, you'll need to get that code at setup time.

## Running the sample

You must have node installed along with npm.

1. clone this repo
2. npm install
3. node sample.js
    * if you want some debug messages: DEBUG=* node sample js

That should be enough to get you started. This was my first node app so I welcome feedback and contributions to make it better.
