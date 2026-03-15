const IGNORED_KEYS = new Set(["Tab", "Shift", "Control", "Alt", "Meta", "CapsLock", "ArrowLeft", "ArrowRight"]);

class Definition {
    rawDefinition;
    isMute;
    term;
    normalizedTerm;

    constructor(rawDefinition) {
        this.rawDefinition = rawDefinition;

        const _term = rawDefinition.substring(3, rawDefinition.indexOf("</B>"));
        this.isMute = _term.startsWith("*");
        this.term = _term.replace("*", "");

        this.normalizedTerm = Data.normalizeForSearch(this.term);
    }

    expand = () => {
        const commaIndex = this.term.indexOf(",");
        const subterm = (commaIndex > -1 ? this.term.substring(0, commaIndex) : this.term)
            .replace("*", "");
        const subdef = this.rawDefinition.substring(this.rawDefinition.indexOf("</B>") + 4);
        return [this.term.replaceAll("~", subterm), subdef.replaceAll("~", `<U>${subterm}</U>`)];
    };
}

class Data {
    definitions = []; // [ Definition ]

    initialize = () => {
        this._readDictionaryData();
        console.log(`Loaded ${this.definitions.length} definitions`);
    }

    generateSearchResults = (query, shouldLookInside) => {
        const results = [];
        const isShortQuery = query.length <= 2;
        this.definitions.forEach(definition => {
            let found = false;
            if (isShortQuery) {
                found = definition.normalizedTerm === query;

            } else if (shouldLookInside) {
                const normalizedDefinition = Data.normalizeForSearch(definition.rawDefinition);
                const textOnlyDefinition = normalizedDefinition.replace(/<[^>]*>/g, "");
                found = textOnlyDefinition.includes(query);

            } else {
                found = definition.normalizedTerm.startsWith(query);
            }

            if (found) {
                results.push(definition);
            }
        });
        return results;
    }

    //

    _readDictionaryData = () => {
        ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z"]
            .flatMap(letter => FR_DATA[letter])
            .forEach((rawDefinition) => {
                if (rawDefinition !== undefined && rawDefinition.startsWith("<B>")) {
                    this.definitions.push(new Definition(rawDefinition));
                }
            });
    }

    _expandDefinition = (originalTerm, definition) => {
        const commaIndex = originalTerm.indexOf(",");
        const subterm = (commaIndex > -1 ? originalTerm.substring(0, commaIndex) : originalTerm)
            .replace("*", "");
        const subdef = definition.substring(definition.indexOf("</B>") + 4);
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
        this.searchInput.addEventListener("focus", () => {
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
            suggestedTermEntries.forEach((definition) => {
                const li = document.createElement("li");
                li.title = definition.term;
                li.innerHTML = definition.rawDefinition.replaceAll("<BR>", " ");
                li.onclick = () => {
                    this.state.updateSearchQuery(definition.term);
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
            searchResults.forEach((definition) => {
                count++;
                const normalizedTerm = definition.normalizedTerm;
                const originalTerm = definition.term;
                const rawDefinition = definition.rawDefinition;
                const li = document.createElement("li");
                const expandedDefinition = definition.expand();
                li.innerHTML = expandedDefinition[1];

                const termAnchorName = `--anchor_term_${count}`;
                const termEl = document.createElement("span");
                termEl.className = "term";
                termEl.style.anchorName = termAnchorName;
                termEl.textContent = expandedDefinition[0];
                termEl.onclick = () => {
                    this.sourceButton.onclick = () => {
                        this.sourceLabel.textContent = rawDefinition;
                        this._showPopover(this.sourcePopover);
                    }
                    this.reportButton.onclick = () => {
                        this._reportDefinition(encodeURIComponent(normalizedTerm));
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

                if (definition.isMute) {
                    const muteEl = document.createElement("span");
                    muteEl.className = "mute";
                    muteEl.textContent = "*";
                    li.prepend(muteEl);
                }

                this.resultList.appendChild(li);
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

    _performSearch = () => {
        const searchQuery = this.searchInput.value.trim();
        if (searchQuery.length > 0) {
            this.state.updateSearchQuery(searchQuery);
            this.state.performSearch();
            this.state.updateHistory();
        }
    }

    _processSearchInput = (event) => {
        const key = event.key;
        if (key === "Enter") {
            this._performSearch();
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
        this._performSearch();
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

    _reportDefinition(term) {
        const url = `https://docs.google.com/forms/d/e/1FAIpQLSfvDmSBcWPNiWHgPTWqXRikONgijGEXMPUtHloRQuVCZ8Q2wQ/` +
            `formResponse?usp=pp_url` +
            `&entry.1299933712=-1` +
            `&entry.1567861638=${term}` +
            `&entry.1828344261=issue` +
            `&submit=Submit`
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
            this.updateSearchQuery(selectedSuggestion.term);
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
            for (let i = 0; i < this.data.definitions.length; i++) {
                const definition = this.data.definitions[i];
                const normalizedTerm = definition.normalizedTerm;
                if (normalizedTerm.startsWith(normalizedSearchQuery)) {
                    suggestions.push(definition);
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
        localStorage.setItem("searchHistory", JSON.stringify(this._searchHistory.slice(0, 25)));
    }
    readHistoryFromPersistence = () => {
        const history = localStorage.getItem("searchHistory");
        if (history) {
            this._searchHistory = JSON.parse(history);
            this.onRestoredHistory(this._searchHistory);
        }
    }
}
