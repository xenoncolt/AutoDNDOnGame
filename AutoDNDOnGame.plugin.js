/**
 * @name AutoDNDOnGame
 * @description Automatically set your status to Do Not Disturb when you launch a game
 * @version 1.2.0
 * @author Xenon Colt
 * @authorLink https://xenoncolt.live
 * @website https://github.com/xenoncolt/AutoDNDOnGame
 * @source https://raw.githubusercontent.com/xenoncolt/AutoDNDOnGame/main/AutoDNDOnGame.plugin.js
 * @invite vJRe78YmN8
 */

const config = {
    main: "AutoDNDOnGame.plugin.js",
    info: {
        name: "AutoDNDOnGame",
        authors: [
            {
                name: "Xenon Colt",
                authorId: "709210314230726776",
                github_username: "xenoncolt",
                link: "https://xenoncolt.live"
            }
        ],
        version: "1.2.0",
        description: "Automatically set your status to Do Not Disturb when you launch a game",
        github: "https://github.com/xenoncolt/AutoDNDOnGame",
        invite: "vJRe78YmN8",
        github_raw: "https://raw.githubusercontent.com/xenoncolt/AutoDNDOnGame/main/AutoDNDOnGame.plugin.js"
    },
    helpers: ":3",
    changelog: [
        {
            title: "New Features & Improvements",
            type: "added",
            items: [
                "Added an option in Settings to choose which game DND will work for (now you can make it work only for specific games)",
            ]
         },
        // {
        //     title: "Fixed Few Things",
        //     type: "fixed",
        //     items: [
        //         "Fixed `Change status to :` UI problem",
        //         "Fixed problem when discord force closes where it doesn't set your status back to online",
        //     ]
        // },
        {
            title: "Changed Few Things",
            type: "changed",
            items: [
                "Migrated to new BetterDiscord v1.3.0 api",
            ]
        }
    ],
    settingsPanel: [
        {
            type: "radio",
            name: "Change Status To:",
            note: "What status should be set when you launch a game?",
            id: "inGameStatus",
            value: "dnd",
            options: [
                {
                    name: "Do Not Disturb",
                    value: "dnd",
                    color: "#6C0F0F"
                },
                {
                    name: "Invisible",
                    value: "invisible",
                    color: "#242222"
                },
                {
                    name: "Idle",
                    value: "idle",
                    color: "#BB9C00"
                }
            ]
        },
        {
            type: "slider",
            name: "Back to Online Delay:",
            note: "How long should the plugin wait before setting your status back to online after you close a game?",
            id: "revertDelay",
            min: 5,
            max: 120,
            units: "s",
            value: 10,
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
            value: true
        },
        {
            type: "switch",
            id: "startupOnline",
            name: "Set Online on Startup",
            note: "Change your status to online when Discord starts if you're not already online",
            value: true,
        },
        {
            type: "category",
            name: "Games List",
            id: "games",
            collapsible: true,
            shown: false,
            settings: []
        }
    ]
};

// let settings = {};

let defaultSettings = {
    inGameStatus: "dnd",
    revertDelay: 10,
    showToasts: true,
    startupOnline: true
}

const { Webpack, UI, Logger, Data, Utils } = BdApi;


class AutoDNDOnGame {
    constructor() {
        this._config = config;
        this.settings;

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
        this.settings = Data.load(this._config.info.name, "settings") || defaultSettings;

        this.presenceStore = Webpack.Stores.PresenceStore;
        this.CurrentUserStore = Webpack.Stores.UserStore;
        this.UserSettingsProtoStore = Webpack.Stores.UserSettingsProtoStore;
        if (!this.presenceStore) {
            UI.showToast("PresenceStore not found. The plugin cannot function properly.", { type: "error" });
            return;
        }

        if (this.settings.startupOnline) {
            const currentStatus = this.currentStatus();
            if (currentStatus !== 'online') {
                this.updateStatus("online");
                if (this.settings.showToasts) {
                    UI.showToast("Status changed to online on startup", { type: "success" });
                }
                Logger.info(this._config.info.name, "Changed status to online on startup");
            }
        }

        this.presenceStore.addChangeListener(this.boundHandlePresenceChange);

        if (Data.load(this._config.info.name, "settings") == null) {
            Data.save(this._config.info.name, "settings", this.settings);
        }

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
        const games = Webpack.Stores.RunningGameStore.getGamesSeen().map(g => {
            return {
                name: g.name,
                id: g.id,
            }
        });

        this._config.settingsPanel.find(cat => cat.id === "games").settings = games.map(g => {
            return {
                type: "switch",
                id: g.id,
                name: g.name,
                note: `Toggle monitoring for ${g.name}`,
                value: this.settings[g.id] !== undefined ? this.settings[g.id] : true,
            }
        });

        for (const setting of this._config.settingsPanel) {
            if (this.settings[setting.id] !== undefined) {
                setting.value = this.settings[setting.id];
            }
        }

        return UI.buildSettingsPanel({
            settings: this._config.settingsPanel,
            onChange: (category, id, value) => {
                this.settings[id] = value; 
                Data.save(this._config.info.name, "settings", this.settings);
            },
        });
    }


    handlePresenceChange() {
        const currentUser = this.CurrentUserStore.getCurrentUser();
        if (!currentUser) return;
        const activities = this.presenceStore.getActivities(currentUser.id);

        // activity type 0 = playing
        const isPlayingGame =
            Array.isArray(activities) &&
            activities.some(activity => activity.type === 0 && activity.name);
        if (isPlayingGame && activities.some(activity => this.settings[activity.application_id] !== false)) {
            console.log("working");
            if (!this.hasSetStatus) {
                if (this.currentStatus() !== this.settings.inGameStatus) {
                    this.updateStatus(this.settings.inGameStatus);
                    this.hasSetStatus = true;
                    this.statusChangeCount++;
                    if (this.settings.showToasts) UI.showToast(`Game detected. Changing status to ${this.settings.inGameStatus}`, { type: "danger" });
                    if (this.revertTimeoutId) {
                        clearTimeout(this.revertTimeoutId);
                        this.revertTimeoutId = null;
                    }
                } else {
                    Logger.info(this._config.info.name, "Status is already set to in-game status");
                }
            }
        } else {
            if (this.hasSetStatus) {
                if (this.revertTimeoutId) clearTimeout(this.revertTimeoutId);
                this.revertTimeoutId = setTimeout(() => {
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