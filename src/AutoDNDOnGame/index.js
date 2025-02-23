/**
 * 
 * @param {import("zerespluginlibrary").Plugin} Plugin 
 * @param {import("zerespluginlibrary").BoundAPI} Library 
 * @returns 
 */

/**
 * @typedef {import("../../BDPluginLibrary/src/ui/ui").ContextMenu} ContextMenu
 * @typedef {import("../../BDPluginLibrary/src/ui/ui").DiscordContextMenu} DiscordContextMenu
 * @typedef {import("../../BDPluginLibrary/src/ui/ui").Modals} Modals
 * @typedef {import("../../BDPluginLibrary/src/ui/ui").Popouts} Popouts
 * @typedef {import("../../BDPluginLibrary/src/ui/ui").ErrorBoundary} ErrorBoundary
 * @typedef {import("../../BDPluginLibrary/src/ui/ui").Tooltip} Tooltip
 * @typedef {import("../../BDPluginLibrary/src/ui/toasts")} Toasts
 * @typedef {import("../../BDPluginLibrary/src/ui/settings/index")} Settings
 * @typedef {import("../../BDPluginLibrary/src/modules/modules")} Modules
 * @typedef {import("../../BDPluginLibrary/src/structs/plugin.js")} Plugin
 */
/**
 * @typedef {Modules & {
* DiscordContextMenu: DiscordContextMenu,
* ContextMenu: ContextMenu,
* Tooltip: Tooltip,
* Toasts: Toasts,
* Settings: Settings,
* Popouts: Popouts,
* Modals: Modals
* }} Library
*/

/**
* Creates the plugin class.
* @param {typeof Plugin} Plugin
* @param {Library} Library
* @returns {typeof globalThis.Plugin}
*/

module.exports = (Plugin, Library) => {

    const { Logger, Modals, DiscordModules, Patcher, PluginUpdater } = Library;
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

            // this.gameStatusIntervalId = null;
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

            Modals.showChangelogModal(this._config.changelog, this._config.info.version);

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