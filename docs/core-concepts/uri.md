# Hellar URIs

Represents a Hellar payment URI. Hellar URI strings is a good standard to share payment request, sometimes as a Hellar link or using a QR code.

URI Examples:

```
hellar:XuUGDZHrKLo841CyamDbG5W7n59epA71h2
hellar:XuUGDZHrKLo841CyamDbG5W7n59epA71h2?amount=1.2
hellar:XuUGDZHrKLo841CyamDbG5W7n59epA71h2?amount=1.2&message=Payment&label=Satoshi&extra=other-param
```

## URI Validation

The main use that we expect you'll have for the `URI` class in Hellarcore is validating and parsing Hellar URIs. A `URI` instance exposes the address as a Hellarcore `Address` object and the amount in hellars, if present.

The code for validating URIs looks like this:

```javascript
var uriString = 'hellar:XuUGDZHrKLo841CyamDbG5W7n59epA71h2?amount=1.2';
var valid = URI.isValid(uriString);
var uri = new URI(uriString);
console.log(uri.address.network, uri.amount); // 'livenet', 120000000
```

## URI Parameters

All standard parameters can be found as members of the `URI` instance. However a Bitcoin URI may contain other non-standard parameters, all those can be found under the `extra` namespace.

See [the official BIP21 spec](https://github.com/bitcoin/bips/blob/master/bip-0021.mediawiki) for more information.

## Create URI

Another important use case for the `URI` class is creating a Bitcoin URI for sharing a payment request. That can be accomplished by using a dictionary to create an instance of URI.

The code for creating an URI from an Object looks like this:

```javascript
var uri = new URI({
  address: 'XuUGDZHrKLo841CyamDbG5W7n59epA71h2',
  amount: 10000, // in hellars
  message: 'My payment request',
});
console.log(uri.toString()); //hellar:XuUGDZHrKLo841CyamDbG5W7n59epA71h2?amount=0.0001&message=My%20payment%20request
```

Methods `toObject`, `toJSON` and `inspect` remain available.

## fromString

```
var uri = new URI("hellar:XuUGDZHrKLo841CyamDbG5W7n59epA71h2?amount=0.0001&message=My%20payment%20request>")
```

## fromObject

```
var uri = new URI({
          address:"XuUGDZHrKLo841CyamDbG5W7n59epA71h2",
          amount:"10000",
          message:"My payment request"
          })
```
