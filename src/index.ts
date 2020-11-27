import joplin from 'api';

// stores the last opened but unpinned note
var lastOpenedNote: any;

joplin.plugins.register({
	onStart: async function () {
		// TODO: remove what not used
		const COMMANDS = joplin.commands;
		const DATA = joplin.data;
		const PANELS = joplin.views.panels;
		const SETTINGS = joplin.settings;
		const WORKSPACE = joplin.workspace;

		//#region REGISTER USER OPTIONS

		await SETTINGS.registerSection('com.benji300.joplin.tabs.settings', {
			label: 'Note Tabs',
			iconName: 'fas fa-window-maximize',
		});

		// [
		//   {
		//     "id": "note id"
		//   }
		// ]
		await SETTINGS.registerSetting('pinnedNotes', {
			value: [],
			type: 4,
			section: 'com.benji300.joplin.tabs.settings',
			public: false,
			label: 'Pinned Notes',
			description: 'List of pinned notes.'
		});

		// General styles
		await SETTINGS.registerSetting('tabHeight', {
			value: "40",
			type: 1,
			section: 'com.benji300.joplin.tabs.settings',
			public: true,
			label: 'Note Tabs height (px)'
		});
		await SETTINGS.registerSetting('maxTabWidth', {
			value: "150",
			type: 1,
			section: 'com.benji300.joplin.tabs.settings',
			public: true,
			label: 'Maximum Tab width (px)'
		});

		// Advanced styles
		await SETTINGS.registerSetting('mainBackground', {
			value: "var(--joplin-background-color3)",
			type: 2,
			section: 'com.benji300.joplin.tabs.settings',
			public: true,
			advanced: true,
			label: 'Background color'
		});
		await SETTINGS.registerSetting('activeBackground', {
			value: "var(--joplin-background-color)",
			type: 2,
			section: 'com.benji300.joplin.tabs.settings',
			public: true,
			advanced: true,
			label: 'Active background color'
		});
		await SETTINGS.registerSetting('mainForeground', {
			value: "var(--joplin-color-faded)",
			type: 2,
			section: 'com.benji300.joplin.tabs.settings',
			public: true,
			advanced: true,
			label: 'Foreground color'
		});
		await SETTINGS.registerSetting('activeForeground', {
			value: "var(--joplin-color)",
			type: 2,
			section: 'com.benji300.joplin.tabs.settings',
			public: true,
			advanced: true,
			label: 'Active foreground color'
		});
		await SETTINGS.registerSetting('dividerColor', {
			value: "var(--joplin-background-color)",
			type: 2,
			section: 'com.benji300.joplin.tabs.settings',
			public: true,
			advanced: true,
			label: 'Divider color'
		});

		//#endregion

		//#region helper functions

		function getIndexWithAttr(array: any, attr: any, value: any): number {
			for (var i: number = 0; i < array.length; i += 1) {
				if (array[i][attr] === value) {
					return i;
				}
			}
			return -1;
		}

		// Add note with handled id to pinned notes array
		async function pinNote(noteId: string) {
			// check if note is not already pinned, otherwise return
			const pinnedNotes: any = await SETTINGS.value('pinnedNotes');
			const index: number = getIndexWithAttr(pinnedNotes, 'id', noteId);
			if (index != -1) return;

			// pin selected note and update panel
			pinnedNotes.push({ id: noteId });
			SETTINGS.setValue('pinnedNotes', pinnedNotes);
			// console.info(`${JSON.stringify(pinnedNotes)}`);
		}

		// Remove note with handled id from pinned notes array
		async function unpinNote(noteId: string) {
			// check if note is pinned, otherwise return
			const pinnedNotes: any = await SETTINGS.value('pinnedNotes');
			const index: number = getIndexWithAttr(pinnedNotes, 'id', noteId);
			if (index == -1) return;

			// unpin selected note and update panel
			pinnedNotes.splice(index, 1);
			SETTINGS.setValue('pinnedNotes', pinnedNotes);
		}

		//#endregion

		//#region REGISTER COMMANDS

		// Command: pinNote
		// Desc: Pin the selected note to the tabs
		await COMMANDS.register({
			name: 'pinNote',
			label: 'Pin note',
			iconName: 'fas fa-thumbtack',
			enabledCondition: "oneNoteSelected",
			execute: async () => {
				// get the selected note and exit if none is currently selected
				const selectedNote: any = await WORKSPACE.selectedNote();
				if (!selectedNote) return;

				pinNote(selectedNote.id);
				updateTabsPanel();
			}
		});

		// Command: unpinNote
		// Desc: Unpin the selected note from the tabs
		await COMMANDS.register({
			name: 'unpinNote',
			label: 'Unpin note',
			iconName: 'fas fa-times',
			enabledCondition: "oneNoteSelected",
			execute: async () => {
				// get the selected note and exit if none is currently selected
				const selectedNote: any = await WORKSPACE.selectedNote();
				if (!selectedNote) return;

				// unpin note and update panel
				unpinNote(selectedNote.id);
				updateTabsPanel();
			}
		});

		// Command: clearTabs
		// Desc: Clear all pinned tabs
		await COMMANDS.register({
			name: 'clearTabs',
			label: 'Clear all note tabs',
			iconName: 'fas fa-times',
			execute: async () => {
				const pinnedNotes: any = [];
				SETTINGS.setValue('pinnedNotes', pinnedNotes);
				updateTabsPanel();
			}
		});

		//#endregion

		//#region Setup panel

		// prepare panel object
		const panel = await PANELS.create("com.benji300.joplin.tabs.panel");
		await PANELS.addScript(panel, './webview.css');
		await PANELS.addScript(panel, './fa/css/all.css');
		await PANELS.addScript(panel, './webview.js');
		PANELS.onMessage(panel, (message: any) => {
			// TODO currently post message is not reached
			// Remove console outputs when working
			console.info('message received');
			if (message.name === 'openNote') {
				console.info('openNote');
				joplin.commands.execute('openNote', message.id);
			}
			if (message.name === 'pinNote') {
				console.info('pinNote');
				pinNote(message.id);
				updateTabsPanel();
			}
			if (message.name === 'unpinNote') {
				console.info('unpinNote');
				unpinNote(message.id);
				updateTabsPanel();
			}
		});

		// prepare tab HTML
		async function prepareTabHtml(note: any, selectedNote: any, pinned: boolean): Promise<string> {
			// get style values from settings
			const height: number = await SETTINGS.value('tabHeight');
			const maxWidth: number = await SETTINGS.value('maxTabWidth');
			const mainBg: string = await SETTINGS.value('mainBackground');
			const mainFg: string = await SETTINGS.value('mainForeground');
			const activeBg: string = await SETTINGS.value('activeBackground');
			const activeFg: string = await SETTINGS.value('activeForeground');
			const dividerColor: string = await SETTINGS.value('dividerColor');

			// prepare style attributes
			const background: string = (note.id == selectedNote.id) ? activeBg : mainBg;
			const foreground: string = (note.id == selectedNote.id) ? activeFg : mainFg;
			const activeTab: string = (note.id == selectedNote.id) ? " active" : "";
			const newTab: string = (pinned) ? "" : " new";
			const icon: string = (pinned) ? "fa-times" : "fa-thumbtack";
			const iconTitle: string = (pinned) ? "Unpin" : "Pin";

			const html = `
				<div role="tab" class="tab${activeTab}${newTab}"
					style="height:${height}px;max-width:${maxWidth}px;border-color:${dividerColor};background:${background};">
					<div class="tab-inner" data-id="${note.id}">
						<span class="title" data-id="${note.id}" style="color:${foreground};">
							${note.title}
						</span>
						<a href="#" class="fas ${icon}" title="${iconTitle}" data-id="${note.id}" style="color:${foreground};">
						</a>
					</div>
				</div>
			`;
			return html;
		}

		// update HTML content
		async function updateTabsPanel() {
			const tabsHtml: any = [];
			const selectedNote: any = await joplin.workspace.selectedNote();
			var selectedNoteIsNew: boolean = true;

			// add all pinned notes as tabs
			const pinnedNotes: any = await SETTINGS.value('pinnedNotes');
			for (const pinnedNote of pinnedNotes) {
				var realNote: any = null;
				if (selectedNote && pinnedNote.id == selectedNote.id) {
					selectedNoteIsNew = false;
				}

				// check if note id still exists - otherwise remove from pinned notes and continue with next one
				try {
					realNote = await DATA.get(['notes', pinnedNote.id], { fields: ['id', 'title'] });
				} catch (error) {
					unpinNote(pinnedNote.id);
					continue;
				}

				tabsHtml.push((await prepareTabHtml(realNote, selectedNote, true)).toString());
			}

			// check whether selected note is not pinned but active - than set as lastOpenedNote
			if (selectedNote) {
				if (selectedNoteIsNew) {
					lastOpenedNote = selectedNote;
				} else {
					// if note is already pinned but also still last opened - clear last opened
					if (lastOpenedNote && lastOpenedNote.id == selectedNote.id) {
						lastOpenedNote = null;
					}
				}
			}

			// check whether last opened note still exists - clear if not
			if (lastOpenedNote) {
				try {
					realNote = await DATA.get(['notes', lastOpenedNote.id], { fields: ['id'] });
				} catch (error) {
					lastOpenedNote = null;
				}
			}

			// add last opened or current selected note at last (unpinned)
			if (lastOpenedNote) {
				tabsHtml.push((await prepareTabHtml(lastOpenedNote, selectedNote, false)).toString());
			}

			// get setting style values
			const height: number = await SETTINGS.value('tabHeight');
			const mainBg: string = await SETTINGS.value('mainBackground');
			const mainFg: string = await SETTINGS.value('mainForeground');

			// add notes to container and push to panel
			await PANELS.setHtml(panel, `
					<div class="container" style="background:${mainBg};">
						<div role="tablist" class="tabs-container">
							${tabsHtml.join('\n')}
						</div>
						<div class="controls" style="height:${height}px;">
							<button class="move-left">
								<i class="fas fa-chevron-left" style="color:${mainFg};"></i>
							</button>
							<button class="move-right">
								<i class="fas fa-chevron-right" style="color:${mainFg};"></i>
							</button>
						</div>
					</div>
				`);
		}

		//#endregion

		//#region Map events

		joplin.workspace.onNoteSelectionChange(() => {
			updateTabsPanel();
		});

		joplin.workspace.onNoteContentChange(() => {
			updateTabsPanel();
		});

		//#endregion

		updateTabsPanel();
		console.info('com.benji300.joplin.tabs started!');
	},
});
