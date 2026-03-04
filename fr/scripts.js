const CORRECTED_DEFINITIONS_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQLq5WSntmnMpg4_kpAXlP5z-knal1u_aYpcqCk-6SxbHnx8fw6ddWwsES7D2cwSCTpj1TrrerCsU8j/pub?gid=25454357&single=true&output=tsv";
const IGNORED_KEYS = new Set(["Tab", "Shift", "Control", "Alt", "Meta", "CapsLock", "ArrowLeft", "ArrowRight"]);

class TermEntry {
    normalizedTerm;
    originalTerm;
    isMute;
    defs;

    constructor(normalizedTerm, originalTerm, isMute, defs) {
        this.normalizedTerm = normalizedTerm;
        this.originalTerm = originalTerm;
        this.isMute = isMute;
        this.defs = defs;
    }
}

class Data {
    definitions = new Map(); // { normalizedTerm : TermEntry }
    normalizedTerms = []; // [ normalizedTerm ]

    initialize = async () => {
        this._readBaseDictionaryData();
        return this._readCorrectedDictionaryData()
            .then(_ => {
                this.normalizedTerms.push(...this.definitions.keys());
                this.normalizedTerms.sort();

                console.log(`Loaded ${this.definitions.size} definitions`);
            });
    }

    generateSearchResults = (query, shouldLookInside) => {
        const results = [];
        const isShortQuery = query.length <= 2;
        this.definitions.forEach((termEntry, normalizedTerm) => {
            let found = false;
            if (isShortQuery) {
                found = normalizedTerm === query;

            } else if (shouldLookInside) {
                for (let i = 0; i < termEntry.defs.length; i++) {
                    let def = termEntry.defs[i];
                    let normalizedDef = Data.normalizeForSearch(def);
                    let textOnlyDef = normalizedDef.replace(/<[^>]*>/g, "");
                    if (textOnlyDef.includes(query)) {
                        found = true;
                        break;
                    }
                }
            } else {
                found = normalizedTerm.startsWith(query);
            }

            if (found) {
                results.push(termEntry);
            }
        });
        return results;
    }

    //

    _readBaseDictionaryData = () => {
        ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z"]
            .flatMap(letter => FR_DATA[letter])
            .forEach((def) => {
                if (def !== undefined && def.startsWith("<B>")) {
                    const term = def.substring(3, def.indexOf("</B>"));
                    const isMute = term.startsWith("*");

                    const normalizedTerm = Data.normalizeForSearch(term).replace("*", "");
                    const originalTerm = term.replace("*", "");
                    let termEntry = this.definitions.get(normalizedTerm);
                    if (termEntry === undefined) {
                        termEntry = new TermEntry(normalizedTerm, originalTerm, isMute, []);
                        this.definitions.set(normalizedTerm, termEntry);
                    }
                    termEntry.defs.push(def);
                }
            });
    }

    _readTextData = async (url) => {
        try {
            const response = await fetch(url);
            if (response.ok) {
                return await response.text();
            }
        } catch (error) {
            console.error("Could not read text data", error.message);
        }
        return "";
    }

    _readCorrectedDictionaryData = async () => {
        console.log("Reading corrected dictionary data...");
        const text = await this._readTextData(CORRECTED_DEFINITIONS_URL)
        const lines = text.split("\r\n");
        lines.forEach(line => {
            const parts = line.split("\t");
            if (parts.length >= 4) {
                try {
                    const term = parts[1];
                    const index = parts[2];
                    const correctedDef = parts[3];
                    const entry = this.definitions.get(term);
                    if (entry !== undefined && correctedDef !== undefined && correctedDef.length > 0) {
                        entry.defs[index] = correctedDef;
                        console.log("Stored correction:", parts);
                    }
                } catch (e) {
                    console.error("Error reading corrected dictionary data:", e);
                }
            }
        });
    }

    _expandDef = (originalTerm, def) => {
        const commaIndex = originalTerm.indexOf(",");
        const subterm = (commaIndex > -1 ? originalTerm.substring(0, commaIndex) : originalTerm)
            .replace("*", "");
        const subdef = def.substring(def.indexOf("</B>") + 4);
        return [originalTerm.replaceAll("~", subterm), subdef.replaceAll("~", `<U>${subterm}</U>`)];
    }

    static normalizeForSearch = (input) => {
        return input
            .toLowerCase()
            .replaceAll('æ', 'ae')
            .replaceAll('œ', 'oe')
            .replaceAll('ç', 'c')
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replaceAll(",", "")
            .replaceAll("'", "");
    }

    static normalizeForHighlighting = (input) => {
        return input
            .toLowerCase()
            .replaceAll('ae', 'æ')
            .replaceAll('oe', 'œ')
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");
    }
}

class UI {
    searchInput;
    lookInsideToggleButton;
    resultList;
    suggestionsPopover;
    suggestionsList;
    controlPopover;
    littreButton;
    cnrtlButton;
    wiktionaryButton;
    sourceButton;
    reportButton;
    sourcePopover;
    sourceLabel;
    historyList;
    clearHistoryButton;
    highlightsToggleButton;

    constructor(state) {
        this.state = state;
    }

    initialize = () => {
        this.searchInput = document.getElementById("searchInput");
        this.lookInsideToggleButton = document.getElementById("lookInsideToggleButton");
        this.resultList = document.getElementById("resultList");
        this.suggestionsPopover = document.getElementById("suggestionsPopover");
        this.suggestionsList = document.getElementById("suggestionsList");
        this.controlPopover = document.getElementById("controlPopover");
        this.littreButton = document.getElementById("littreButton");
        this.cnrtlButton = document.getElementById("cnrtlButton");
        this.wiktionaryButton = document.getElementById("wiktionaryButton");
        this.sourceButton = document.getElementById("sourceButton");
        this.reportButton = document.getElementById("reportButton");
        this.sourcePopover = document.getElementById("sourcePopover");
        this.sourceLabel = document.getElementById("sourceLabel");
        this.historyList = document.getElementById("historyList");
        this.clearHistoryButton = document.getElementById("clearHistoryButton");
        this.highlightsToggleButton = document.getElementById("highlightsToggleButton");

        //

        this.searchInput.addEventListener("keyup", this._processSearchInput);
        this.searchInput.addEventListener("mouseenter", () => {
            this._selectSearchInputText();
        });
        document.addEventListener("visibilitychange", () => {
            if (!document.hidden) {
                this._selectSearchInputText();
            }
        });

        this.lookInsideToggleButton.addEventListener("click", this._processLookInsideToggleButton);
        this.clearHistoryButton.addEventListener("click", this.state.clearHistory);
        this.highlightsToggleButton.addEventListener("click", this.state.toggleHighlights)

        // state handlers
        this.state.onUpdatedSearchQuery = (searchQuery) => {
            this.searchInput.value = searchQuery;
        }
        this.state.onUpdatedLookInside = (lookInside) => {
            this.lookInsideToggleButton.classList.toggle("selected", lookInside);
        }
        this.state.onUpdatedSuggestions = (suggestedTermEntries) => {
            if (suggestedTermEntries.length === 0) {
                this._hidePopover(this.suggestionsPopover);
            } else {
                this._showPopover(this.suggestionsPopover);
            }

            this.suggestionsList.textContent = "";
            suggestedTermEntries.forEach((termEntry) => {
                const li = document.createElement("li");
                li.title = termEntry.originalTerm;
                li.innerHTML = termEntry.defs.join("\n").replaceAll("<BR>", " ");
                li.onclick = () => {
                    this.state.updateSearchQuery(termEntry.originalTerm);
                    this.state.performSearch();
                    this.state.updateHistory();
                };
                this.suggestionsList.appendChild(li);
            })
        }
        this.state.onUpdatedSelectedSuggestionIndex = (index) => {
            const children = this.suggestionsList.children;
            for (let i = 0; i < children.length; i++) {
                children[i].classList.toggle('selected', i === index);
            }
        }
        this.state.onUpdatedSearchResults = (searchResults) => {
            if (this.state._highlightsEnabled) {
                this._cleanupHighlights();
            }

            this.resultList.scrollTo(0, 0);
            this.resultList.textContent = "";

            let count = 0;
            searchResults.forEach((termEntry) => {
                const normalizedTerm = termEntry.normalizedTerm;
                const originalTerm = termEntry.originalTerm;
                termEntry.defs.forEach((def, index) => {
                    count++;
                    const li = document.createElement("li");
                    const expanded = this.state.data._expandDef(originalTerm, def);
                    li.innerHTML = expanded[1];

                    const termAnchorName = `--anchor_term_${count}`;
                    const termEl = document.createElement("span");
                    termEl.className = "term";
                    termEl.style.anchorName = termAnchorName;
                    termEl.textContent = expanded[0];
                    termEl.onclick = () => {
                        this.sourceButton.onclick = () => {
                            this.sourceLabel.textContent = def;
                            this._showPopover(this.sourcePopover);
                        }
                        this.reportButton.onclick = () => {
                            this._reportDefinition(encodeURIComponent(normalizedTerm), encodeURIComponent(index));
                            this._hidePopover(this.controlPopover);
                        };

                        const commaIndex = originalTerm.indexOf(",");
                        const searchTerm = commaIndex > -1 ? originalTerm.substring(0, originalTerm.indexOf(",")) : originalTerm;
                        this.littreButton.onclick = () => {
                            this._hidePopover(this.controlPopover);
                            this._openLink(`https://www.littre.org/definition/${searchTerm}`);
                        }
                        this.cnrtlButton.onclick = () => {
                            this._hidePopover(this.controlPopover);
                            this._openLink(`https://www.cnrtl.fr/definition/${searchTerm}`);
                        }
                        this.wiktionaryButton.onclick = () => {
                            this._hidePopover(this.controlPopover);
                            this._openLink(`https://fr.wiktionary.org/wiki/${searchTerm}`);
                        }

                        this.controlPopover.style.positionAnchor = termAnchorName;
                        this.controlPopover.style.top = `anchor(${termAnchorName} bottom)`;
                        this.controlPopover.style.left = `anchor(${termAnchorName} left)`;
                        this._showPopover(this.controlPopover);
                    }
                    li.prepend(termEl);

                    if (termEntry.isMute) {
                        const muteEl = document.createElement("span");
                        muteEl.className = "mute";
                        muteEl.textContent = "*";
                        li.prepend(muteEl);
                    }

                    this.resultList.appendChild(li);
                });
            });

            this._selectSearchInputText();

            if (this.state._highlightsEnabled) {
                this._generateHighlights();
            }
        }
        this.state.onRestoredHistory = (history) => {
            history.forEach((query) => {
                const li = document.createElement("li");
                li.classList.add("restored");
                li.textContent = query;
                li.onclick = () => {
                    li.classList.remove("restored");
                    this.state.updateSearchQuery(query);
                    this.state.performSearch();
                }
                this.historyList.append(li);
            });
        }
        this.state.onClearedHistory = () => {
            this.historyList.scrollTo(0, 0);
            this.historyList.textContent = "";
        }
        this.state.onAddedHistory = (query) => {
            const li = document.createElement("li");
            li.textContent = query;
            li.onclick = () => {
                this.state.updateSearchQuery(query);
                this.state.performSearch();
            }
            this.historyList.prepend(li);
        }
        this.state.onReusedHistory = (index) => {
            const li = this.historyList.children[index];
            li.classList.remove("restored");
            this.historyList.removeChild(li);
            this.historyList.prepend(li);
        }
        this.state.onUpdatedHighlights = (highlights) => {
            this.highlightsToggleButton.classList.toggle("selected", highlights);
            if (highlights) {
                this._generateHighlights();
            } else {
                this._cleanupHighlights();
            }
        }
    }

    _processSearchInput = (event) => {
        const key = event.key;
        if (key === "Enter") {
            this.state.updateSearchQuery(this.searchInput.value.trim());
            this.state.performSearch();
            this.state.updateHistory();
        } else if (key === "ArrowUp") {
            this.state.selectPreviousSuggestion();
        } else if (key === "ArrowDown") {
            this.state.selectNextSuggestion();
        } else if (key === "Escape") {
            this.state.clearSuggestionSelection();
        } else if (!IGNORED_KEYS.has(key)) {
            this.state.updateSuggestions(this.searchInput.value.trim());
        }
    }

    _processLookInsideToggleButton = (event) => {
        this.state.toggleLookInside();
        this.state.performSearch();
    }

    _selectSearchInputText = () => {
        this.searchInput.focus();
        this.searchInput.select();
    }

    _generateHighlights = () => {
        const query = this.state._searchQuery;

        const ranges = [];
        if (CSS && CSS.highlights && query.length >= 2) {
            const treeWalker = document.createTreeWalker(this.resultList, NodeFilter.SHOW_TEXT);
            const textNodes = [];
            let currentNode = treeWalker.nextNode();
            while (currentNode) {
                textNodes.push(currentNode);
                currentNode = treeWalker.nextNode();
            }

            const normalizedQuery = Data.normalizeForHighlighting(query);

            textNodes.forEach((node) => {
                const text = Data.normalizeForHighlighting(node.textContent);
                let startPos = 0;
                while (startPos < text.length) {
                    const index = text.indexOf(normalizedQuery, startPos);
                    if (index === -1) {
                        break;
                    }
                    const range = new Range();
                    range.setStart(node, index);
                    range.setEnd(node, index + normalizedQuery.length);
                    if (!range.collapsed) {
                        ranges.push(range);
                    }
                    startPos = index + normalizedQuery.length;
                }
            });
            const searchResultsHighlight = new Highlight(...ranges);
            CSS.highlights.set("search-results", searchResultsHighlight);
        }
        return ranges.length;
    }

    _cleanupHighlights = () => {
        if (CSS && CSS.highlights) {
            CSS.highlights.clear();
        }
    }

    _showPopover = (popover) => {
        if (!popover) {
            return;
        }
        if (!popover.matches(":popover-open")) {
            popover.showPopover();
        }
    }

    _hidePopover = (popover) => {
        if (!popover) {
            return;
        }
        if (popover.matches(":popover-open")) {
            popover.hidePopover();
        }
    }

    _openLink(url) {
        open(url, "_blank")
    }

    _reportDefinition(term, index) {
        const url = `https://docs.google.com/forms/d/e/1FAIpQLSfvDmSBcWPNiWHgPTWqXRikONgijGEXMPUtHloRQuVCZ8Q2wQ/` + `formResponse?usp=pp_url` + `&entry.1299933712=${index}` + `&entry.1567861638=${term}` + `&submit=Submit`
        this._openLink(url);
    }
}

class State {
    data;

    _searchQuery = "";
    _shouldLookInside = false;
    _searchResults = [];

    _suggestions = [];
    _selectedSuggestionIndex = -1;

    _searchHistory = [];

    _highlightsEnabled = false;

    constructor(data) {
        this.data = data;
    }

    // handlers
    onUpdatedSearchQuery = (value) => {
    }
    onUpdatedLookInside = (lookInside) => {
    }
    onUpdatedSuggestions = (suggestions) => {
    }
    onUpdatedSelectedSuggestionIndex = (index) => {
    }
    onUpdatedSearchResults = (searchResults) => {
    }
    onRestoredHistory = (history) => {
    }
    onClearedHistory = () => {
    }
    onAddedHistory = (query) => {
    }
    onReusedHistory = (index) => {
    }
    onUpdatedHighlights = (highlights) => {
    }

    // search
    updateSearchQuery = (query) => {
        if (this._searchQuery !== query) {
            this._searchQuery = query;
            this.onUpdatedSearchQuery(this._searchQuery);
        }
    }
    toggleLookInside = () => {
        this._shouldLookInside = !this._shouldLookInside;
        this.onUpdatedLookInside(this._shouldLookInside);
    }
    performSearch = () => {
        if (this._selectedSuggestionIndex > -1 && this._suggestions.length > 0 && this._selectedSuggestionIndex < this._suggestions.length) {
            const selectedSuggestion = this._suggestions[this._selectedSuggestionIndex];
            this.updateSearchQuery(selectedSuggestion.originalTerm);
        }

        const searchResults = [];
        if (this._searchQuery.length >= 1) {
            const normalizedSearchQuery = Data.normalizeForSearch(this._searchQuery);
            searchResults.push(...this.data.generateSearchResults(normalizedSearchQuery, this._shouldLookInside));
            console.log(`Found ${searchResults.length} results for '${this._searchQuery}'`);
        }
        this._searchResults = searchResults;

        this.clearSuggestions();
        this.onUpdatedSearchResults(this._searchResults);
    }

    // suggestions
    selectPreviousSuggestion = () => {
        const currentValue = this._selectedSuggestionIndex;
        this._selectedSuggestionIndex--;
        if (this._selectedSuggestionIndex < 0) {
            this._selectedSuggestionIndex = this._suggestions.length - 1;
        }
        if (currentValue !== this._selectedSuggestionIndex) {
            this.onUpdatedSelectedSuggestionIndex(this._selectedSuggestionIndex);
        }
    }
    selectNextSuggestion = () => {
        const currentValue = this._selectedSuggestionIndex;
        this._selectedSuggestionIndex++;
        if (this._selectedSuggestionIndex >= this._suggestions.length) {
            this._selectedSuggestionIndex = 0;
        }
        if (currentValue !== this._selectedSuggestionIndex) {
            this.onUpdatedSelectedSuggestionIndex(this._selectedSuggestionIndex);
        }
    }
    clearSuggestionSelection = () => {
        const currentValue = this._selectedSuggestionIndex;
        this._selectedSuggestionIndex = -1;
        if (currentValue !== this._selectedSuggestionIndex) {
            this.onUpdatedSelectedSuggestionIndex(this._selectedSuggestionIndex);
        }
    }
    updateSuggestions = (searchQuery) => {
        const suggestions = [];

        if (searchQuery.length > 0) {
            const normalizedSearchQuery = Data.normalizeForSearch(searchQuery);
            for (let i = 0; i < this.data.normalizedTerms.length; i++) {
                const normalizedTerm = this.data.normalizedTerms[i];
                if (normalizedTerm.startsWith(normalizedSearchQuery)) {
                    let termEntry = this.data.definitions.get(normalizedTerm);
                    suggestions.push(termEntry);
                    if (suggestions.length >= 12) {
                        break;
                    }
                }
            }
        }
        this._suggestions = suggestions;
        this.clearSuggestionSelection();
        this.onUpdatedSuggestions(this._suggestions);
    }
    clearSuggestions = () => {
        this._selectedSuggestionIndex = -1;
        this.onUpdatedSelectedSuggestionIndex(this._selectedSuggestionIndex);
        this._suggestions = [];
        this.onUpdatedSuggestions(this._suggestions);
    }

    // highlights
    toggleHighlights = () => {
        this._highlightsEnabled = !this._highlightsEnabled;
        this.onUpdatedHighlights(this._highlightsEnabled);
    }

    // history
    clearHistory = () => {
        this._searchHistory = [];
        this.onClearedHistory(this._searchHistory);

        this.writeHistoryToPersistence();
    }
    updateHistory = () => {
        const existingIndex = this._searchHistory.indexOf(this._searchQuery);
        if (existingIndex > -1) {
            this._searchHistory.splice(existingIndex, 1);
            this._searchHistory.unshift(this._searchQuery);
            this.onReusedHistory(existingIndex);
        } else {
            this._searchHistory.unshift(this._searchQuery);
            this.onAddedHistory(this._searchQuery);
        }

        this.writeHistoryToPersistence();
    }
    writeHistoryToPersistence = () => {
        localStorage.setItem("searchHistory", JSON.stringify(this._searchHistory.slice(0, 100)));
    }
    readHistoryFromPersistence = () => {
        const history = localStorage.getItem("searchHistory");
        if (history) {
            this._searchHistory = JSON.parse(history);
            this.onRestoredHistory(this._searchHistory);
        }
    }
}
