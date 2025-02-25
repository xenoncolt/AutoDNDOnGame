/**
 * @name AutoDNDOnGame
 * @description Automatically set your status to Do Not Disturb when you launch a game
 * @version 1.0.3
 * @author Xenon Colt
 * @authorLink https://xenoncolt.me
 * @website https://github.com/xenoncolt/AutoDNDOnGame
 * @source https://raw.githubusercontent.com/xenoncolt/AutoDNDOnGame/main/AutoDNDOnGame.plugin.js
 * @invite vJRe78YmN8
 */

const config = {
    main: "AutoDNDOnGame.plugin.js",
    id: "xenoncolt",
    name: "AutoDNDOnGame",
    author: "Xenon Colt",
    authorId: "709210314230726776",
    authorLink: "https://xenoncolt.me",
    version: "1.0.3",
    description: "Automatically set your status to Do Not Disturb when you launch a game",
    website: "https://xenoncolt.me",
    source: "https://github.com/xenoncolt/AutoDNDOnGame",
    invite: "vJRe78YmN8",
    info: {
        name: "AutoDNDOnGame",
        authors: [
            {
                name: "Xenon Colt",
                github_username: "xenoncolt",
                link: "https://xenoncolt.me"
            }
        ],
        version: "1.0.3",
        description: "Automatically set your status to Do Not Disturb when you launch a game",
        github: "https://github.com/xenoncolt/AutoDNDOnGame",
        invite: "vJRe78YmN8",
        github_raw: "https://raw.githubusercontent.com/xenoncolt/AutoDNDOnGame/main/AutoDNDOnGame.plugin.js"
    },
    helpers: ":3",
    changelog: [
        {
            title: "Fixed BD compatibility issue",
            type: "fixed",
            items: [
                "Prevent plugin from breaking BD",
                "Prevent plugin from spamming status change"
            ]
        }
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
        },
        {
            type: "slider",
            name: "Back to Online Delay:",
            note: "How long should the plugin wait before setting your status back to online after you close a game?",
            id: "pollingInterval",
            value: () => settings.pollingInterval,
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

let settings = {};

let defaultSettings = {
    inGameStatus: "dnd",
    revertDelay: 10,
    showToasts: true,
    pollingInterval: 5000
}

const { Webpack, Patcher, Net, React, UI, Logger, Data, Components, DOM } = BdApi;


class AutoDNDOnGame {
    constructor() {
        this._config = config;
        //Save settings or load defaults
        this.settings = Data.load(this._config.name, "settings") || defaultSettings;

        this.hasSetStatus = false;
        this.revertTimeoutId = null;
        this.statusChangeCount = 0;
        this.statusChangeThreshold = 5;
        this.statusChangeResetTime = null;
        this.boundHandlePresenceChange = this.handlePresenceChange.bind(this);
    }

    getName() {
        return this._config.info.name;
    }

    getVersion() {
        return this._config.info.version;
    }

    getAuthor() {
        return this._config.info.authors[0].name;
    }

    getDescription() {
        return this._config.info.description;
    }

    load() { }

    start() {
        try {
            let currentVersionInfo = {};
            try {
                currentVersionInfo = Object.assign({}, { version: this._config.version, hasShownChangelog: false }, Data.load("AutoDNDOnGame", "currentVersionInfo"));
            } catch (err) {
                currentVersionInfo = { version: this._config.version, hasShownChangelog: false };
            }
            if (this._config.version != currentVersionInfo.version) currentVersionInfo.hasShownChangelog = false;
            currentVersionInfo.version = this._config.version;
            Data.save(this._config.name, "currentVersionInfo", currentVersionInfo);

            this.checkForUpdate();

            if (!currentVersionInfo.hasShownChangelog) {
                UI.showChangelogModal({
                    title: "AutoDNDOnGame Changelog",
                    subtitle: config.version,
                    changes: [{
                        title: config.changelog[0].title,
                        type: config.changelog[0].type,
                        items: config.changelog[0].items
                    }]
                });
                currentVersionInfo.hasShownChangelog = true;
                Data.save(this._config.name, "currentVersionInfo", currentVersionInfo);
            }
        }
        catch (err) {
            Logger.error(this._config.name, err);
        }

        settings = Object.assign({}, defaultSettings, Data.load(this._config.name, "settings"));

        // Retrieve the presence store from BdApi.Webpack
        this.presenceStore = Webpack.getStore("PresenceStore");
        this.CurrentUserStore = Webpack.getModule(m => m?.getCurrentUser, { first: true });
        this.UserSettingsProtoStore = Webpack.getModule(m => m && typeof m.getName === "function" && m.getName() === "UserSettingsProtoStore", { first: true, searchExports: true });
        this.UserSettingsProtoUtils = Webpack.getModule(m => m.ProtoClass && m.ProtoClass.typeName.endsWith(".PreloadedUserSettings"), { first: true, searchExports: true });
        if (!this.presenceStore) {
            UI.showToast("PresenceStore not found. The plugin cannot function properly.", { type: "error" });
            return;
        }

        this.presenceStore.addChangeListener(this.boundHandlePresenceChange);
        // this.pollingInterval = setInterval(() => this.handlePresenceChange(), this.settings.pollingInterval);

        this.saveAndUpdate();

        // Counting status change 
        this.statusChangeReset = setInterval(() => {
            this.statusChangeCount = 0;
            Logger.info(this._config.name, "Status change count reset");
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
        if (this.hasSetStatus) {
            this.updateStatus("online");
            this.hasSetStatus = false;
        }
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
    }

    getSettingsPanel() {
        // const panel = document.createElement("div");
        // panel.style.padding = "10px";

        // // Dropdown
        // const statusLabel = document.createElement("label");
        // statusLabel.textContent = "In-Game Status: ";
        // const statusSelect = document.createElement("select");
        // ["dnd", "idle", "invisible"].forEach(optionValue => {
        //     const option = document.createElement("option");
        //     option.value = optionValue;
        //     option.textContent = optionValue.toUpperCase();
        //     if (this.settings.inGameStatus === optionValue) option.selected = true;
        //     statusSelect.appendChild(option);
        // });
        // statusSelect.addEventListener("change", e => {
        //     this.settings.inGameStatus = e.target.value;
        //     BdApi.saveData(this._config.name, "settings", this.settings);
        // });
        // panel.appendChild(statusLabel);
        // panel.appendChild(statusSelect);
        // panel.appendChild(document.createElement("br"));
        // panel.appendChild(document.createElement("br"));

        // // Show Toasts Setting (Checkbox)
        // const toastLabel = document.createElement("label");
        // toastLabel.textContent = "Show Toasts: ";
        // const toastCheckbox = document.createElement("input");
        // toastCheckbox.type = "checkbox";
        // toastCheckbox.checked = this.settings.showToasts;
        // toastCheckbox.addEventListener("change", e => {
        //     this.settings.showToasts = e.target.checked;
        //     BdApi.saveData(this._config.id, "settings", this.settings);
        // });
        // panel.appendChild(toastLabel);
        // panel.appendChild(toastCheckbox);

        // return panel;
        return UI.buildSettingsPanel({
            settings: this._config.settingsPanel,
            onChange: (category, id, value) => {
                settings[id] = value;
                // Data.save(this._config.id, "settings", settings);
                this.saveAndUpdate();
            },
        });
    }

    saveAndUpdate() {
        Data.save(this._config.id, "settings", this.settings);
    }

    // Called when the presence changes.
    handlePresenceChange() {
        if (!this.CurrentUserStore) return;
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
            if (this.currentStatus() !== this.settings.inGameStatus) {
                this.updateStatus(this.settings.inGameStatus);
                this.hasSetStatus = true;
                this.statusChangeCount++;
                if (this.settings.showToasts) UI.showToast(`Game detected. Changing status to ${this.settings.inGameStatus}`);
                if (this.revertTimeoutID) {
                    clearTimeout(this.revertTimeoutID);
                    this.revertTimeoutID = null;
                }
            } else {
                Logger.info(this._config.name, "Status change limit reached. Skipping status change");
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
                        if (this.settings.showToasts) UI.showToast("No game detected. Reverting status to online.");
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
            Logger.info(this._config.name, "Status change limit reached. Skipping status change");
        }

        this.UserSettingsProtoUtils.updateAsync("status", statusSetting => {
            statusSetting.status.value = toStatus;
        }, 0);
    }


    // checkForUpdate() {
    //     fetch(this._config.info.github_raw, { headers: { "User-Agent": "BetterDiscord" } })
    //         .then(response => response.text())
    //         .then(text => {
    //             const versionMatch = text.match(/@version\s+([^\s]+)/);
    //             if (versionMatch) {
    //                 const latestVersion = versionMatch[1].trim();
    //                 if (this.versionCompare(latestVersion, this.getVersion()) > 0) {
    //                     UI.showConfirmationModal("Update Available", `A new version (${latestVersion}) is available. Would you like to update?`, {
    //                         confirmText: "Update",
    //                         cancelText: "Later",
    //                         onConfirm: () => {
    //                             require("electron").shell.openExternal(this._config.info.github_raw);
    //                         }
    //                     });
    //                 }
    //             }
    //         })
    //         .catch(err => {
    //             console.error("Failed to check for updates:", err);
    //         });
    // }

    async checkForUpdate() {
        try {
            let fileContent = await (await fetch(this._config.info.github_raw, { headers: { "User-Agent": "BetterDiscord" } })).text();
            let remoteMeta = this.parseMeta(fileContent);
            if (this.versionCompare(remoteMeta.version, this.getVersion()) > 0) {
                this.newUpdateNotify(remoteMeta, fileContent);
            }
        }
        catch (err) {
            Logger.error(this._config.name, err);
        }

    }

    newUpdateNotify(remoteMeta, remoteFile) {
        Logger.info(this._config.name, "A new update is available!");

        UI.showConfirmationModal("Update Available", [`Update ${remoteMeta.version} is now available for AutoDNDOnGame!`, "Press Download Now to update!"], {
            confirmText: "Download Now",
            onConfirm: async (e) => {
                if (remoteFile) {
                    await new Promise(r => require("fs").writeFile(require("path").join(BdApi.Plugins.folder, `${this._config.name}.plugin.js`), remoteFile, r));
                    try {
                        let currentVersionInfo = Data.load(this._config.name, "currentVersionInfo");
                        currentVersionInfo.hasShownChangelog = false;
                        Data.save(this._config.name, "currentVersionInfo", currentVersionInfo);
                    } catch (err) {
                        UI.showToast("An error occurred when trying to download the update!", { type: "error" });
                    }
                }
            }
        });
    }

    // Compare semantic version strings.
    versionCompare(v1, v2) {
        const v1parts = v1.split('.').map(Number);
        const v2parts = v2.split('.').map(Number);
        for (let i = 0; i < Math.max(v1parts.length, v2parts.length); i++) {
            const a = v1parts[i] || 0;
            const b = v2parts[i] || 0;
            if (a > b) return 1;
            if (a < b) return -1;
        }
        return 0;
    }

    parseMeta(fileContent) {
        const meta = {};
        const regex = /@([a-zA-Z]+)\s+(.+)/g;
        let match;
        while ((match = regex.exec(fileContent)) !== null) {
            meta[match[1]] = match[2].trim();
        }
        return meta;
    }

    // Show changelog modal if the saved version differs from the current.
    // showChangelog() {
    //     const savedVersion = BdApi.loadData(this._config.id, "version");
    //     if (savedVersion !== this.getVersion()) {
    //         UI.showChangelogModal(this.getName(), this.getVersion(), this._config.changelog);
    //         BdApi.saveData(this._config.id, "version", this.getVersion());
    //     }
    // }
}

module.exports = AutoDNDOnGame;
/*@end@*/