**Usage**: `new URI(data)`  
**Description**: Instantiate an URI from a Hellar URI String or an Object. A URI instance can be created with a Hellar URI string or an object.
All instances of URI are valid, the static method isValid allows checking before instantiation.
All standard parameters can be found as members of the class, the address is represented using an {Address} instance and the amount is represented in hellars. Any other non-standard parameters can be found under the extra member.

| parameters      | type                 | required | Description                    |
| --------------- | -------------------- | -------- | ------------------------------ |
| **data**        | Object/Buffer/String | yes      | A Hellar URI string or an Object |
| **knownParams** | String[]             | yes      | Required non-standard params   |

**Returns**: {URI} A new valid and frozen instance of URI

## URI.fromString(str)

**Description**: Instantiate a URI from an Object

**Parameters**:

| parameter | type   | required | Description                      |
| --------- | ------ | -------- | -------------------------------- |
| **str**   | String | yes      | JSON string or object of the URI |

**Returns**: {URI} A new instance of a URI

## URI.fromObject(data)

**Description**: Instantiate a URI from an Object

**Parameters**:

| parameter | type   | required | Description               |
| --------- | ------ | -------- | ------------------------- |
| **obj**   | Object | yes      | A plain JavaScript object |

**Returns**: {URI} A new instance of a URI

## URI.isValid(data, knownParams)

**Description**: Check if a hellar URI string is valid

**Parameters**:

| parameter | type   | required | Description       |
| --------- | ------ | -------- | ----------------- |
| **uri**   | String | yes      | A hellar URI string |

**Returns**: {Object} An object with the parsed params

```js
const isValid = URI.isValid('hellar:XsV4GHVKGTjQFvwB7c6mYsGV3Mxf7iser6'); //true
```

## URI.parse(uri)

**Description**: Convert a Hellar URI string into a simple object.

**Parameters**:

| parameter | type   | required | Description       |
| --------- | ------ | -------- | ----------------- |
| **uri**   | String | yes      | A hellar URI string |

Returns : {Object} An object with the parsed params

## .toJSON() / .toObject()

**Description**: Will return an object representation of a URI

**Parameters**: None.

**Returns**: {Object} A plain object with the URI properties

## .toString()

**Description**: Will return a string representation of the URI

**Parameters**: None.

**Returns**: {string} Hellar URI string

## .inspect()

**Description**: Will return a string formatted for the console

**Parameters**: None.

**Returns**: {string} Hellar URI

```js
const uri = new URI(...);
bluriock.toInspect() // <URI: hellar:Xo4vyw1FtA88rYPYjbNT9kwhVokHHsSuPG>
```
