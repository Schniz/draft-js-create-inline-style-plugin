// @flow

import { ContentBlock, Modifier, SelectionState, EditorState } from 'draft-js';
import curry from 'curry';
import { OrderedSet, List, Repeat } from 'immutable';

type StylesArray = Array<string>;

type DraftPluginsEditorFns = {
	setEditorState: (editorState : EditorState) => void;
	getEditorState: (_ : void) => EditorState;
};

type InlineStyleDecorator = {
	strategy: Function;
	styles: StylesArray;
}

type StyleChange = {
	start: number;
	end: number;
	styles: StylesArray;
	blockKey: string;
}

function getChangesToApplyForState(decorator : InlineStyleDecorator, editorState : EditorState) : Array<StyleChange> {
	const changes : Array<StyleChange> = [];
	const cb = curry((blockKey, start, end) => changes.push({ blockKey, start, end, styles: decorator.styles }));
	const blockMap = editorState.getCurrentContent().getBlockMap();

	blockMap.forEach(block => {
		decorator.strategy(block, cb(block.getKey()));
	});

	return changes;
}

function limitSelection(selection : SelectionState, block : ContentBlock) {
	return selection.set(
		'anchorOffset',
		Math.max(selection.getStartOffset(), 0)
	).set(
		'focusOffset',
		Math.min(block.getText().length, selection.getEndOffset()),
	);
}

function createSelectionForChange(change : StyleChange) {
	return SelectionState.createEmpty(change.blockKey).set('anchorOffset', change.start).set('focusOffset', change.end);
}

function applyInlineStyles(content, selection, styles, incrementApplied) {
	return styles.reduce(
		(accContent, style) => {
			const block = content.getBlockForKey(selection.getStartKey());
			const chars = block.getCharacterList().slice(selection.getStartOffset(), selection.getEndOffset());
			const stylesInBlock = chars.map(e => e.getStyle().toList());
			const styleList = Repeat(List(styles), stylesInBlock.size);
			const needToChange = !stylesInBlock.equals(styleList);

			if (needToChange) {
				incrementApplied();
			}

			return Modifier.applyInlineStyle(accContent, selection, style);
		},
		content,
	);
}

function resetStateToUnstyled(editorState : EditorState) {
	return EditorState.setInlineStyleOverride(editorState, []);
}

function applyChangesToState(changes: Array<StyleChange>, state : EditorState) : void | EditorState {
	let changesApplied = 0;
	const incrementApplied = () => changesApplied += 1;
	const content = changes.reduce(
		(newContent, change) => {
			return applyInlineStyles(
				newContent,
				limitSelection(createSelectionForChange(change), newContent.getBlockForKey(change.blockKey)),
				change.styles,
				incrementApplied,
			);
		},
		state.getCurrentContent(),
	);

	const maybeTheNewState = resetStateToUnstyled(
		EditorState.acceptSelection(
			EditorState.push(
				state,
				content,
				'apply-inline-styles'
			),
			state.getSelection(),
		),
	);

	return !changesApplied ? state : maybeTheNewState;
}

function syncExecuteStrategies(decorators : Array<InlineStyleDecorator>, { getEditorState }) {
	const editorState = getEditorState();
	const changesToApply = decorators.reduce((changes, decorator) => {
		const changesInDecorator = getChangesToApplyForState(decorator, editorState) || [];
		return changes.concat(changesInDecorator);
	}, []);
	const afterChanges = applyChangesToState(changesToApply, getEditorState());
	return afterChanges;
}

function executeStrategies(decorators, callbacks) {
	setTimeout(() => {
		callbacks.setEditorState(syncExecuteStrategies(decorators, callbacks) || callbacks.getEditorState());
	});
}

function stripStyles(callbacks : DraftPluginsEditorFns, afterwards : Function) {
	const state = callbacks.getEditorState();
	const currentContent = state.getCurrentContent();

	const newContent = currentContent.getBlockMap().reduce(
		(contentState, block) => {
			const allBlock = SelectionState.createEmpty(block.getKey()).set('anchorOffset', 0).set('focusOffset', block.getText().length);
			return Modifier.replaceText(
				contentState,
				allBlock,
				block.getText(),
				OrderedSet([]),
			);
		},
		currentContent,
	);

	afterwards(
		EditorState.acceptSelection(
			EditorState.push(
				state,
				newContent,
			),
			state.getSelection(),
		),
	);
}

function checkIfWeNeedToStripStyles(callbacks : DraftPluginsEditorFns, afterwards : Function) {
	const currentState = callbacks.getEditorState();
	const selectedState = EditorState.forceSelection(
		currentState,
		currentState.getSelection(),
	);

	if (selectedState.getCurrentInlineStyle().size > 0) {
		setTimeout(() => stripStyles(callbacks, afterwards));
		return true;
	}
}

export default (decoratorsToApply : Array<InlineStyleDecorator>) => {
	const decorators = [].concat(decoratorsToApply);

	return {
		onChange(state : EditorState) {
			const callbacks = {
				getEditorState: () => state,
			};

			const newState = syncExecuteStrategies(decorators, callbacks) || state;
			return EditorState.setInlineStyleOverride(newState, OrderedSet([]));
		},

		handleKeyCommand(command : string, callbacks : DraftPluginsEditorFns) {
			if (command === 'backspace') {
				const selection = callbacks.getEditorState().getSelection();
				checkIfWeNeedToStripStyles(callbacks, state => {
					executeStrategies(decorators, {
						...callbacks,
						getEditorState: () => state,
					});
				});
			}
		},

		handleReturn(e : any, callbacks : DraftPluginsEditorFns) {
			checkIfWeNeedToStripStyles(callbacks, newState => {
				executeStrategies(decorators, {
					...callbacks,
					getEditorState: () => newState,
				});
			});
		},
	};
};
