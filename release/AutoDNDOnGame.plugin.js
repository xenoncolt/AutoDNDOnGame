/**
 * @name AutoDNDOnGame
 * @description Automatically set your status to Do Not Disturb when you launch a game
 * @version 0.2.0
 * @author Xenon Colt
 * @authorLink https://github.com/xenoncolt
 * @website https://github.com/xenoncolt/AutoDNDOnGame
 * @source https://raw.githubusercontent.com/xenoncolt/AutoDNDOnGame/main/release/AutoDNDOnGame.plugin.js
 * @invite https://discord.gg/vJRe78YmN8vJRe78YmN8
 */
/*@cc_on
@if (@_jscript)
    
    // Offer to self-install for clueless users that try to run this directly.
    var shell = WScript.CreateObject("WScript.Shell");
    var fs = new ActiveXObject("Scripting.FileSystemObject");
    var pathPlugins = shell.ExpandEnvironmentStrings("%APPDATA%\\BetterDiscord\\plugins");
    var pathSelf = WScript.ScriptFullName;
    // Put the user at ease by addressing them in the first person
    shell.Popup("It looks like you've mistakenly tried to run me directly. \n(Don't do that!)", 0, "I'm a plugin for BetterDiscord", 0x30);
    if (fs.GetParentFolderName(pathSelf) === fs.GetAbsolutePathName(pathPlugins)) {
        shell.Popup("I'm in the correct folder already.", 0, "I'm already installed", 0x40);
    } else if (!fs.FolderExists(pathPlugins)) {
        shell.Popup("I can't find the BetterDiscord plugins folder.\nAre you sure it's even installed?", 0, "Can't install myself", 0x10);
    } else if (shell.Popup("Should I copy myself to BetterDiscord's plugins folder for you?", 0, "Do you need some help?", 0x34) === 6) {
        fs.CopyFile(pathSelf, fs.BuildPath(pathPlugins, fs.GetFileName(pathSelf)), true);
        // Show the user where to put plugins in the future
        shell.Exec("explorer " + pathPlugins);
        shell.Popup("I'm installed!", 0, "Successfully installed", 0x40);
    }
    WScript.Quit();

@else@*/
const config = {
    main: "index.js",
    id: "xenoncolt",
    name: "AutoDNDOnGame",
    author: "Xenon Colt",
    authorId: "709210314230726776",
    authorLink: "https://xenoncolt.me",
    version: "0.2.0",
    description: "Automatically set your status to Do Not Disturb when you launch a game",
    website: "https://xenoncolt.me",
    source: "https://github.com/xenoncolt/AutoDNDOnGame",
    invite: "https://discord.gg/vJRe78YmN8vJRe78YmN8",
    info: {
        name: "AutoDNDOnGame",
        authors: [
            {
                name: "Xenon Colt",
                github_username: "xenoncolt",
                link: "https://github.com/xenoncolt"
            }
        ],
        version: "0.2.0",
        description: "Automatically set your status to Do Not Disturb when you launch a game",
        github: "https://github.com/xenoncolt/AutoDNDOnGame",
        invite: "https://discord.gg/vJRe78YmN8vJRe78YmN8",
        github_raw: "https://raw.githubusercontent.com/xenoncolt/AutoDNDOnGame/main/release/AutoDNDOnGame.plugin.js"
    },
    changelog: [
        {
            type: "added",
            title: "Added Auto Update",
            items: [
                "The plugin will now automatically update when a new version is available"
            ]
        }
    ],
    defaultConfig: [
        {
            type: "radio",
            name: "Change Status To:",
            note: "What status should be set when you launch a game?",
            id: "inGameStatus",
            value: "dnd",
            options: [
                {
                    name: "Do Not Disturb",
                    value: "dnd"
                },
                {
                    name: "Invisible",
                    value: "invisible"
                },
                {
                    name: "Idle",
                    value: "idle"
                }
            ]
        },
        {
            type: "slider",
            name: "Back to Online Delay:",
            note: "How long should the plugin wait before setting your status back to online after you close a game?",
            id: "revertDelay",
            defaultValue: 10,
            min: 5,
            max: 120,
            units: "s",
            markers: [
                5,
                15,
                30,
                45,
                60,
                75,
                90,
                105,
                120
            ]
        },
        {
            type: "switch",
            name: "Show Notification",
            note: "Should the plugin show a notification when it changes your status?",
            id: "showToasts",
            value: true,
            defaultValue: true
        },
        {
            type: "slider",
            name: "Back to Online Delay:",
            note: "How long should the plugin wait before setting your status back to online after you close a game?",
            id: "pollingInterval",
            defaultValue: 5000,
            min: 5000,
            max: 60000,
            units: "ms",
            markers: [
                5000,
                15000,
                30000,
                45000,
                60000
            ]
        }
    ]
};
class Dummy {
    constructor() {this._config = config;}
    start() {}
    stop() {}
}
 
if (!global.ZeresPluginLibrary) {
    BdApi.showConfirmationModal("Library Missing", `The library plugin needed for ${config.name ?? config.info.name} is missing. Please click Download Now to install it.`, {
        confirmText: "Download Now",
        cancelText: "Cancel",
        onConfirm: () => {
            require("request").get("https://betterdiscord.app/gh-redirect?id=9", async (err, resp, body) => {
                if (err) return require("electron").shell.openExternal("https://betterdiscord.app/Download?id=9");
                if (resp.statusCode === 302) {
                    require("request").get(resp.headers.location, async (error, response, content) => {
                        if (error) return require("electron").shell.openExternal("https://betterdiscord.app/Download?id=9");
                        await new Promise(r => require("fs").writeFile(require("path").join(BdApi.Plugins.folder, "0PluginLibrary.plugin.js"), content, r));
                    });
                }
                else {
                    await new Promise(r => require("fs").writeFile(require("path").join(BdApi.Plugins.folder, "0PluginLibrary.plugin.js"), body, r));
                }
            });
        }
    });
}
 
module.exports = !global.ZeresPluginLibrary ? Dummy : (([Plugin, Api]) => {
     const plugin = (Plugin, Library) => {

    const { Logger, DiscordModules, Patcher, PluginUpdater } = Library;
    const { Webpack } = BdApi;

    // Retrieve modules used to update the user’s status.
    const UserSettingsProtoStore = Webpack.getModule(
        (m) =>
            m && typeof m.getName === "function" && m.getName() === "UserSettingsProtoStore",
        { first: true, searchExports: true }
    );

    const UserSettingsProtoUtils = Webpack.getModule(
        (m) =>
            m.ProtoClass && m.ProtoClass.typeName.endsWith(".PreloadedUserSettings"),
        { first: true, searchExports: true }
    );

    // Modules for obtaining the current user and their presence (activities)
    const CurrentUserStore = BdApi.Webpack.getModule((m) => m?.getCurrentUser, {
        first: true,
    });

    // const PresenceStore = BdApi.Webpack.getStore("PresenceStore");
    

    // function expectWithKey(options) {
    //     const module = Webpack.getModule(options.filter, { searchExports: true });
    //     if (!module) {
    //         Logger.error(`Module ${options.name} not found.`);
    //         return null;
    //     }
    //     // Return the first function key found
    //     for (const key in module) {
    //         if (typeof module[key] === "function") {
    //             return [module, key];
    //         }
    //     }
    //     return null;
    // }

    // const ActivityStatus = expectWithKey({
    //     filter: Webpack.Filters.byStrings("questsIcon", "CUSTOM_STATUS"),
    //     name: "ActivityStatus"
    // });

    let DEBUG = false;
    function log_debug(module, ...message) {
        if (DEBUG !== true) return;
        Logger.debug(module, ...message);
    }

    return class AutoDNDOnGame extends Plugin {
        constructor() {
            super();
            // Default settings
            this.getSettingsPanel = () => {
                return this.buildSettingsPanel().getElement();
            };

            this.gameStatusIntervalId = null;
            // A key used to store game status set by the plugin
            this.keyGameStatusSetByPlugin = "GameStatusSetByPlugin";
            // Flag to know if the plugin previously set the status.
            this.hasSetStatus = false;
            // To hold the timeout id for status reversion.
            this.revertTimeoutID = null;
            // Bind the presence change handler.
            this.boundHandlePresenceChange = this.handlePresenceChange.bind(this);
        }

        onStart() {
            if (this._config.DEBUG === true) {
                DEBUG = true;
                log_debug(this, "Current status: " + this.currentStatus());
            }

            // if (ActivityStatus) {
            //     const [module, key] = ActivityStatus;
            //     // Patch the ActivityStatus component to detect activity changes
            //     Patcher.after(this._config.info.name,module, key, (_, [props], ret) => {
            //         if (!props || !props.activities) return;
            //         const activities = props.activities;
            //         // Detect if any activity type 0 (Playing a game) is present
            //         const isPlayingGame = activities.some(activity => activity.type === 0 && activity.name);
            //         log_debug("Activity patch", "isPlayingGame:", isPlayingGame, "activities:", activities);
            //         if (isPlayingGame) {
            //             if (this.currentStatus() !== this.settings.inGameStatus) {
            //                 this.updateStatus(this.settings.inGameStatus);
            //                 BdApi.saveData(this._config.info.name, this.keyGameStatusSetByPlugin, true);
            //                 this.showToast(`Game detected. Changing status to ${this.settings.inGameStatus}`);
            //             } else {
            //                 // If the plugin set the status revert it back to online with delay
            //                 if (BdApi.loadData(this._config.info.name, this.keyGameStatusSetByPlugin)) {
            //                     if (this.revertTimeoutId) {
            //                         clearTimeout(this.revertTimeoutId);
            //                     }
            //                     this.revertTimeoutId = setTimeout(() => {
            //                         // Double check if the user is still playing a game or not
            //                         if (!activities.some(activity => activity.type === 0 && activity.name)) {
            //                             this.updateStatus("online");
            //                             BdApi.saveData(this._config.info.name, this.keyGameStatusSetByPlugin, false);
            //                             this.showToast("Status reverted back to online");
            //                         }
            //                     }, this.settings.revertDelay * 1000);
            //                 }
            //             }
            //         }
            //     });
            // } else {
            //     Logger.error("Activity Status module not found. The plugin is not working properly");
            // }

            // polling for game activity
            // this.gameStatusIntervalId = setInterval(() => {
            //     this.checkActivity();
            // }, this.settings.pollingInterval);

            PluginUpdater.checkForUpdate(this._config.info.name, this._config.info.version, this._config.info.github_raw);

            this.presenceStore = Webpack.getStore("PresenceStore");
            if (!this.presenceStore) {
                Logger.error("PresenceStore not found. The plugin is not working properly");
                return;
            }
            this.presenceStore.addChangeListener(this.boundHandlePresenceChange);
        }

        onStop() {
            // if (this.gameStatusIntervalId) {
            //     clearInterval(this.gameStatusIntervalId);
            //     this.gameStatusIntervalId = null;
            // }

            // Patcher.unpatchAll(this._config.info.name);
            // if (this.revertTimeoutId) {
            //     clearTimeout(this.revertTimeoutId);
            //     this.revertTimeoutId = null;
            // }

            // Revert status back to online if it was changed by plugin
            // const was_set = BdApi.loadData(
            //     this._config.info.name,
            //     this.keyGameStatusSetByPlugin
            // );
            // if (was_set) {
            //     this.updateStatus("online");
            //     BdApi.saveData(this._config.info.name, this.keyGameStatusSetByPlugin, false);
            // }

            if (this.presenceStore) {
                this.presenceStore.removeChangeListener(this.boundHandlePresenceChange);
            }
            if (this.revertTimeoutId) {
                clearTimeout(this.revertTimeoutId);
                this.revertTimeoutId = null;
            }

            if (this.hasSetStatus) {
                this.updateStatus("online");
                this.hasSetStatus = false;
            }
        }

        handlePresenceChange() {
            const currentUser = CurrentUserStore.getCurrentUser();
            if (!currentUser) return;
            const activities = this.presenceStore.getActivities(currentUser.id);
            log_debug("Presence changed. Activities:", activities);

            // Look for an activity of type 0 (Playing a game)
            const isPlayingGame = Array.isArray(activities) && activities.some((activity) => activity.type === 0 && activity.name);

            if (isPlayingGame) {
                // If playing and status isn’t already set, update to in-game status.
                if (this.currentStatus() !== this.settings.inGameStatus) {
                    this.updateStatus(this.settings.inGameStatus);
                    this.hasSetStatus = true;
                    this.showToast(`Game detected. Changing status to ${this.settings.inGameStatus}`);
                    // Clear any pending revert timeout.
                    if (this.revertTimeoutID) {
                        clearTimeout(this.revertTimeoutID);
                        this.revertTimeoutID = null;
                    }
                }
            } else {
                // If previously set by our plugin and no game is detected, schedule a revert.
                if (this.hasSetStatus) {
                    if (this.revertTimeoutID) clearTimeout(this.revertTimeoutID);
                    this.revertTimeoutID = setTimeout(() => {
                        // Double-check: if still no game activity, revert to online.
                        const updatedActivities = this.presenceStore.getActivities(currentUser.id);
                        const stillPlaying =
                            Array.isArray(updatedActivities) && updatedActivities.some((activity) => activity.type === 0 && activity.name);
                        if (!stillPlaying) {
                            this.updateStatus("online");
                            this.hasSetStatus = false;
                            this.showToast("No game detected. Reverting status to online.");
                        }
                    }, this.settings.revertDelay * 1000);
                }
            }
        }

        /**
         * Retrieves the current status of the user.
         * @returns {string}
         */
        currentStatus() {
            return UserSettingsProtoStore.settings.status.status.value;
        }

        /**
         * Updates the user's status
         * @param {('online'|'idle'|'invisible'|'dnd')} toStatus 
         * @returns 
         */

        updateStatus(toStatus) {
            if (this._config.DEBUG === true && this._config.DEBUG_ActuallyChangeStatus === false) {
                log_debug("Simulated status change to: ", toStatus);
                return;
            }
            log_debug("Updating status to: ", toStatus);
            UserSettingsProtoUtils.updateAsync("status", (statusSetting) => {
                log_debug(statusSetting);
                statusSetting.status.value = toStatus;
            }, 0);
        }

        /**
         * Display the toast message if enabled in settings.
         * @param {string} msg
         */
        showToast(msg) {
            if (this.settings.showToasts) {
                BdApi.showToast(msg);
            }
        }
    };
};
     return plugin(Plugin, Api);
})(global.ZeresPluginLibrary.buildPlugin(config));
/*@end@*/