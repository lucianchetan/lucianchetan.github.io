class Definition {
    rawDefinition;
    textOnlyDefinition;
    term;

    constructor(rawDefinition) {
        this.rawDefinition = rawDefinition;
        this.textOnlyDefinition = rawDefinition.replace(/<[^>]*>/g, "");
        const rawTerm = rawDefinition.substring(3, rawDefinition.indexOf("</B>"));
        this.term = rawTerm.replace("*", "");
    }
}

class Match {
    index;
    value;

    constructor(index, value) {
        this.index = index;
        this.value = value;
    }
}

class FindResult {
    definition; // Definition
    matches; // [ Match ]

    constructor(definition, matches) {
        this.definition = definition;
        this.matches = matches;
    }
}

class Data {
    definitions = []; // [ Definition ]

    initialize = () => {
        this._readDictionaryData();
        console.log(`Loaded ${this.definitions.length} definitions`);
    }

    generateSearchResults = (query, textOnly) => {
        const results = [];
        const regex = new RegExp(query, "g");
        this.definitions.forEach(definition => {
            const content = textOnly ?
                definition.textOnlyDefinition :
                definition.rawDefinition;

            const matches = [];
            let match;
            while ((match = regex.exec(content)) !== null) {
                matches.push(new Match(match.index, match[0]));
            }

            if (matches.length > 0) {
                results.push(new FindResult(definition, matches));
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
}

class UI {
    searchInput;
    textOnlyToggleButton;
    infoLabel;
    resultList;

    constructor(state) {
        this.state = state;
    }

    initialize = () => {
        this.searchInput = document.getElementById("searchInput");
        this.textOnlyToggleButton = document.getElementById("textOnlyToggleButton");
        this.infoLabel = document.getElementById("infoLabel");
        this.resultList = document.getElementById("resultList");

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

        this.textOnlyToggleButton.addEventListener("click", this._processTextOnlyToggleButton);

        // state handlers
        this.state.onUpdatedSearchQuery = (searchQuery) => {
            this.searchInput.value = searchQuery;
        }
        this.state.onUpdatedTextOnly = (textOnly) => {
            this.textOnlyToggleButton.classList.toggle("selected", textOnly);
        }

        const excess = 30;
        this.state.onUpdatedSearchResults = (searchResults) => {
            this.resultList.scrollTo(0, 0);
            this.resultList.textContent = "";

            let count = 0;
            searchResults.forEach((result) => {
                const definition = result.definition;
                const content = this.state._textOnly ? definition.textOnlyDefinition : definition.rawDefinition;
                count += result.matches.length;
                const matches = result.matches.map(match => {
                    const before = this._dehtml(content.substring(match.index - excess, match.index));
                    const after = this._dehtml(content.substring(match.index + match.value.length, match.index + match.value.length + excess));
                    const value = this._dehtml(match.value);
                    return `<code>${before}<mark>${value}</mark>${after}</code>`;
                }).join("<BR/>");
                const li = document.createElement("li");
                li.innerHTML = `<B>${definition.term}</B> (${result.matches.length})<BR/>${matches}`;
                this.resultList.appendChild(li);
            });

            this.infoLabel.textContent = `${count} result` + (count > 1 ? "s" : "");

            this._selectSearchInputText();
        }

        //
        const params = new URLSearchParams(window.location.search);
        const q = params.get('q');
        if (q) {
            this.searchInput.value = q;
            this._performSearch();
        }
    }

    _dehtml = (input) => {
        return input.replaceAll("<", "&lt;")
        //.replaceAll("&", "&amp;");
    }

    _performSearch = () => {
        const searchQuery = this.searchInput.value.trim();
        if (searchQuery.length > 0) {
            history.replaceState(null, '', '?q=' + encodeURIComponent(searchQuery));
            this.state.updateSearchQuery(searchQuery);
            this.state.performSearch();
        }
    }

    _processTextOnlyToggleButton = (event) => {
        this.state.toggleTextOnly();
        this._performSearch();
    }

    _processSearchInput = (event) => {
        const key = event.key;
        if (key === "Enter") {
            this._performSearch();
        }
    }

    _selectSearchInputText = () => {
        this.searchInput.focus();
        this.searchInput.select();
    }
}

class State {
    data;

    _searchQuery = "";
    _textOnly = false;
    _searchResults = [];

    constructor(data) {
        this.data = data;
    }

    // handlers
    onUpdatedSearchQuery = (value) => {
    }
    onUpdatedTextOnly = (textOnly) => {
    }
    onUpdatedSearchResults = (searchResults) => {
    }

    // search
    updateSearchQuery = (query) => {
        if (this._searchQuery !== query) {
            this._searchQuery = query;
            this.onUpdatedSearchQuery(this._searchQuery);
        }
    }
    toggleTextOnly = () => {
        this._textOnly = !this._textOnly;
        this.onUpdatedTextOnly(this._textOnly);
    }
    performSearch = () => {
        const searchResults = [];
        if (this._searchQuery.length >= 1) {
            searchResults.push(...this.data.generateSearchResults(this._searchQuery, this._textOnly));
        }
        this._searchResults = searchResults;

        this.onUpdatedSearchResults(this._searchResults);
    }
}
