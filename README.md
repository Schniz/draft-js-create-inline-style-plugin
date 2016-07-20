## draft-js-create-inline-style-plugin
Creates a new plugin for using inline styles as decorators.

![Demo](docs/demo.gif)

## WAT
- It all began with this tweet.
- And then there was this issue.

Currently, *There is no way of using nested decorators*, but using decorators is so fun.
So the proposed solution is to handle Draft.js' inline styles as if they were controlled by decorators.

## Installation :hamburger:
```bash
npm install --save draft-js-create-inline-style-plugin
```

## Usage:

```js
import React from 'react';
import Editor from 'draft-js-plugins-editor';
import findWithRegex from 'find-with-regex';
import createInlineStylePlugin from 'draft-js-create-inline-style-plugin';

const STAR_REGEX = /\*.+\*/g;
const TILDE_REGEX = /~.+~/g;

const kindOfMarkdownPlugin = createInlineStylePlugin([{
	strategy: (contentBlock, callback) => findWithRegex(STAR_REGEX, contentBlock, callback),
	styles: ['BOLD']
}, {
	strategy: (contentBlock, callback) => findWithRegex(TILDE_REGEX, contentBlock, callback),
	styles: ['UNDERLINE']
}]);

const MyEditor = ({ editorState, onChange }) => (
  <div>
    <Editor
      editorState={ editorState }
      onChange={ onChange }
      plugins={ [kindOfMarkdownPlugin] }
    />
  </div>
);

export default MyEditor;
```
