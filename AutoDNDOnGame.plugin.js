/**
 * @name AutoDNDOnGame
 * @description Automatically set your status to Do Not Disturb when you launch a game
 * @version 1.0.7
 * @author Xenon Colt
 * @authorLink https://xenoncolt.me
 * @website https://github.com/xenoncolt/AutoDNDOnGame
 * @source https://raw.githubusercontent.com/xenoncolt/AutoDNDOnGame/main/AutoDNDOnGame.plugin.js
 * @invite vJRe78YmN8
 */

const config = {
    main: "AutoDNDOnGame.plugin.js",
    authorId: "709210314230726776",
    website: "https://xenoncolt.me",
    info: {
        name: "AutoDNDOnGame",
        authors: [
            {
                name: "Xenon Colt",
                github_username: "xenoncolt",
                link: "https://xenoncolt.me"
            }
        ],
        version: "1.0.7",
        description: "Automatically set your status to Do Not Disturb when you launch a game",
        github: "https://github.com/xenoncolt/AutoDNDOnGame",
        invite: "vJRe78YmN8",
        github_raw: "https://raw.githubusercontent.com/xenoncolt/AutoDNDOnGame/main/AutoDNDOnGame.plugin.js"
    },
    helpers: ":3",
    changelog: [
        // {
        //     title: "New Features & Improvements",
        //     type: "added",
        //     items: [
        //         "Remove update checking functionality to streamline plugin performance",
        //         "Automatically update the plugin using BD's built-in updater",
        //     ]
        // },
        {
            title: "Fixed Few Things",
            type: "fixed",
            items: [
                "Fixed settings UI not updated after changing value",
                "Fixed a type mistake where status change count was not being reset",
                "",
                "",
            ]
        },
        // {
        //     title: "Changed Few Things",
        //     type: "changed",
        //     items: [
        //         "",
        //         "",
        //         "",
        //         ""
        //     ]
        // }
    ],
    settingsPanel: [
        {
            type: "radio",
            name: "Change Status To:",
            note: "What status should be set when you launch a game?",
            id: "inGameStatus",
            value: () => settings.inGameStatus,
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
            value: () => settings.revertDelay,
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
            value: () => settings.showToasts,
        }
    ]
};

let settings = {};

let defaultSettings = {
    inGameStatus: "dnd",
    revertDelay: 10,
    showToasts: true
}

const { Webpack, UI, Logger, Data, Utils } = BdApi;


class AutoDNDOnGame {
    constructor() {
        this._config = config;
        
        //Save settings or load defaults
        this.settings = Data.load(this._config.info.name, "settings") || defaultSettings;
        settings = this.settings; // ahhhh my brain is not braining 
        this.getSettingsPanel();

        this.hasSetStatus = false;
        this.revertTimeoutId = null;
        this.statusChangeCount = 0;
        this.statusChangeThreshold = 5;
        this.statusChangeResetInterval = null;
        this.boundHandlePresenceChange = this.handlePresenceChange.bind(this);
        try {
            let currentVersionInfo = {};
            try {
                currentVersionInfo = Object.assign({}, { version: this._config.info.version, hasShownChangelog: false }, Data.load("AutoDNDOnGame", "currentVersionInfo"));
            } catch (err) {
                currentVersionInfo = { version: this._config.info.version, hasShownChangelog: false };
            }
            if (this._config.info.version != currentVersionInfo.version) currentVersionInfo.hasShownChangelog = false;
            currentVersionInfo.version = this._config.info.version;
            Data.save(this._config.info.name, "currentVersionInfo", currentVersionInfo);

            if (!currentVersionInfo.hasShownChangelog) {
                UI.showChangelogModal({
                    title: "AutoDNDOnGame Changelog",
                    subtitle: this._config.info.version,
                    changes: this._config.changelog
                });
                currentVersionInfo.hasShownChangelog = true;
                Data.save(this._config.info.name, "currentVersionInfo", currentVersionInfo);
            }
        }
        catch (err) {
            Logger.error(this._config.info.name, err);
        }
    }

    start() {
        settings = Object.assign(this.settings, defaultSettings, Data.load(this._config.info.name, "settings"));
        settings = this.settings;  // synconize with global

        // Retrieve the presence store from BdApi.Webpack
        this.presenceStore = Webpack.getStore("PresenceStore");
        this.CurrentUserStore = Webpack.getStore("UserStore");
        this.UserSettingsProtoStore = Webpack.getStore("UserSettingsProtoStore");
        if (!this.presenceStore) {
            UI.showToast("PresenceStore not found. The plugin cannot function properly.", { type: "error" });
            return;
        }

        this.presenceStore.addChangeListener(this.boundHandlePresenceChange);
        // this.pollingInterval = setInterval(() => this.handlePresenceChange(), this.settings.pollingInterval);

        this.saveAndUpdate();

        // Counting status change 
        this.statusChangeResetInterval = setInterval(() => {
            this.statusChangeCount = 0;
            Logger.info(this._config.info.name, "Status change count reset");
        }, 10 * 60 * 1000);
    }

    stop() {
        if (this.presenceStore) {
            this.presenceStore.removeChangeListener(this.boundHandlePresenceChange);
        }
        if (this.revertTimeoutId) {
            clearTimeout(this.revertTimeoutId);
            this.revertTimeoutId = null;
        }
        if (this.statusChangeResetInterval) {
            clearInterval(this.statusChangeResetInterval);
            this.statusChangeResetInterval = null;
        }
        if (this.hasSetStatus) {
            this.updateStatus("online");
            this.hasSetStatus = false;
        }
    }

    getSettingsPanel() {
        return UI.buildSettingsPanel({
            settings: this._config.settingsPanel.map(setting => ({
                ...setting,
            value: () => this.settings[setting.id]
            })),
            onChange: (category, id, value) => {
                this.settings[id] = value; // this is for instance
                settings[id] = value;  // this is for global
                // Data.save(this._config.id, "settings", settings);
                this.saveAndUpdate();
            },
        });
    }

    saveAndUpdate() {
        Data.save(this._config.info.name, "settings", this.settings);
    }

    // Called when the presence changes.
    handlePresenceChange() {
        const currentUser = this.CurrentUserStore.getCurrentUser();
        if (!currentUser) return;
        const activities = this.presenceStore.getActivities(currentUser.id);
        // Debug log 
        // console.log("Presence changed. Activities:", activities);
        // Look for an activity of type 0 ("Playing") with a non-empty name.
        const isPlayingGame =
            Array.isArray(activities) &&
            activities.some(activity => activity.type === 0 && activity.name);
        if (isPlayingGame) {
            if (!this.hasSetStatus) {
                if (this.currentStatus() !== this.settings.inGameStatus) {
                    this.updateStatus(this.settings.inGameStatus);
                    this.hasSetStatus = true;
                    this.statusChangeCount++;
                    if (this.settings.showToasts) UI.showToast(`Game detected. Changing status to ${this.settings.inGameStatus}`, { type: "danger" });
                    if (this.revertTimeoutID) {
                        clearTimeout(this.revertTimeoutID);
                        this.revertTimeoutID = null;
                    }
                } else {
                    Logger.info(this._config.info.name, "Status change limit reached. Skipping status change");
                }
            }
        } else {
            if (this.hasSetStatus) {
                if (this.revertTimeoutID) clearTimeout(this.revertTimeoutID);
                this.revertTimeoutID = setTimeout(() => {
                    const updatedActivities = this.presenceStore.getActivities(currentUser.id);
                    const stillPlaying =
                        Array.isArray(updatedActivities) &&
                        updatedActivities.some(activity => activity.type === 0 && activity.name);
                    if (!stillPlaying) {
                        this.updateStatus("online");
                        this.hasSetStatus = false;
                        if (this.settings.showToasts) UI.showToast("No game detected. Reverting status to online.", { type: "success" });
                    }
                }, this.settings.revertDelay * 1000);
            }
        }
    }

    currentStatus() {
        return this.UserSettingsProtoStore.settings.status.status.value;
    }

    // Update user status
    updateStatus(toStatus) {
        if (this.statusChangeCount >= this.statusChangeThreshold) {
            Logger.info(this._config.info.name, "Status change limit reached. Skipping status change");
            return;
        }

        const UserSettingsProtoUtils = Webpack.getModule(m => m.ProtoClass && m.ProtoClass.typeName.endsWith(".PreloadedUserSettings"), { first: true, searchExports: true });

        UserSettingsProtoUtils.updateAsync("status", statusSetting => {
            statusSetting.status.value = toStatus;
        }, 0);
    }
}

module.exports = AutoDNDOnGame;
/*@end@*/