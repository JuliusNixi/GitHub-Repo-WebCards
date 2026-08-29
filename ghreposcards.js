var GHRepoCardsInit = (() => {

    async function processGHRepoCards(ENABLE_CACHING) {

        const GITHUB_API_SETTINGS = {
            method: 'GET',
            headers: {
                'Accept': 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28'
            }           
        };
        
        const GITHUB_API_ENDPOINT = "https://api.github.com/";

        // Repos per page asked to the GitHub's APIs (100 is the maximum allowed).
        const PER_PAGE = 100;

        // Maximum number of requests fired at the same time, to avoid the GitHub's
        // APIs secondary rate limit, that is triggered by bursts of concurrent requests.
        const CONCURRENCY = 5;

        const EXPIRATION_HOURS = 1;

        // Key prefix used to remember which repos compose the full list of an owner.
        // '%' is not an admitted character in a GitHub's repo name, so it cannot collide.
        const LIST_KEY_PREFIX = "%all:";

        // Null as arg to clear all.
        function clearDataLocal(repoName) {
            if (repoName !== null && typeof repoName != "string")
                throw new Error(`GitHub-Repos-WebCards: Error in clearDataLocal(). Invalid arg received.`);
            const wanted = repoName === null ? null : repoName.toLowerCase();
            // The keys are collected before removing anything, otherwise removing an item
            // while looping on the localStorage indexes shifts them and skips some entries.
            const keys = [];
            for (let i = 0; i < localStorage.length; i++)
                keys.push(localStorage.key(i));
            for (const key of keys) {
                const value = localStorage.getItem(key);
                if (value === null) continue;
                let parsedValue;
                try {
                    parsedValue = JSON.parse(value);
                } catch (error) {
                    // Not written by this script, so it must be left untouched.
                    continue;
                }
                if (!parsedValue || typeof parsedValue !== 'object') continue;
                if (parsedValue.expiry && parsedValue.repoData) {
                    if (wanted === null || wanted === String(parsedValue.repoData.name).toLowerCase())
                        localStorage.removeItem(key);
                    continue;
                }
                // Owners's full repos lists.
                if (key.startsWith(LIST_KEY_PREFIX) && Array.isArray(parsedValue.repoNames)) {
                    if (wanted === null || parsedValue.repoNames.includes(wanted))
                        localStorage.removeItem(key);
                }
            }
        }
        
        function saveDataLocal(repoData) {
            if (repoData === undefined || repoData === null || typeof repoData != "object")
                throw new Error(`GitHub-Repos-WebCards: Error in saveDataLocal(). Invalid arg received.`);
            if (!ENABLE_CACHING) return;
            const now = new Date();
            const item = {
                repoData: repoData,
                expiry: now.getTime() + (EXPIRATION_HOURS * 60 * 60 * 1000)
            };
            let key = repoData.name.toLowerCase();
            localStorage.setItem(key, JSON.stringify(item));
        }
        
        function getDataLocal() {
            const items = {};
            if (!ENABLE_CACHING) return items;
            const keys = [];
            for (let i = 0; i < localStorage.length; i++)
                keys.push(localStorage.key(i));
            for (const key of keys) {
                const value = localStorage.getItem(key);
                if (value === null) continue;
                let parsedValue;
                try {
                    parsedValue = JSON.parse(value);
                } catch (error) {
                    // Not written by this script, so it must be left untouched.
                    continue;
                }
                if (parsedValue && typeof parsedValue === 'object' && parsedValue.expiry && parsedValue.repoData) {
                    const now = new Date();
                    if (now.getTime() > parsedValue.expiry) {
                        localStorage.removeItem(key);
                        continue;
                    }
                    items[key] = parsedValue;
                }
            }
            return items;
        }

        // An owner's repos list is cached apart from the single repos, so that a download
        // interrupted halfway (a rate limit hit, for example) is not mistaken for a complete one.
        function saveListLocal(userString, repoNames) {
            if (!ENABLE_CACHING) return;
            const now = new Date();
            localStorage.setItem(LIST_KEY_PREFIX + userString, JSON.stringify({
                repoNames: repoNames,
                expiry: now.getTime() + (EXPIRATION_HOURS * 60 * 60 * 1000)
            }));
        }

        function getListLocal(userString) {
            if (!ENABLE_CACHING) return null;
            const key = LIST_KEY_PREFIX + userString;
            const value = localStorage.getItem(key);
            if (value === null) return null;
            try {
                const parsedValue = JSON.parse(value);
                if (!parsedValue || !Array.isArray(parsedValue.repoNames) || !parsedValue.expiry) return null;
                if (new Date().getTime() > parsedValue.expiry) {
                    localStorage.removeItem(key);
                    return null;
                }
                return parsedValue.repoNames;
            } catch (error) {
                localStorage.removeItem(key);
                return null;
            }
        }

        // Only the data actually present in the card's html structure are downloaded,
        // every useless request is a request stolen from the hourly rate limit.
        function neededFields(cardDiv) {
            return {
                languages: cardDiv.querySelector(".gh-repos-cards-languages") !== null,
                watchers: cardDiv.querySelector(".gh-repos-cards-watchers") !== null
            };
        }

        function cachedEntryIsUsable(entry, userString, fields) {
            if (!entry || !entry.repoData || !entry.repoData.owner) return false;
            // Two different owners could have a repo with the same name.
            if (String(entry.repoData.owner.login).toLowerCase() !== userString) return false;
            if (fields.languages && entry.repoData.repoLanguages === undefined) return false;
            if (fields.watchers && entry.repoData.repoWatchers === undefined) return false;
            return true;
        }

        async function mapWithLimit(items, mapper) {
            const results = [];
            for (let i = 0; i < items.length; i += CONCURRENCY) {
                const chunk = items.slice(i, i + CONCURRENCY);
                results.push(...await Promise.all(chunk.map(mapper)));
            }
            return results;
        }
        
        function putData(repoData, cardDiv) {
            if (repoData === undefined || typeof repoData != "object" || cardDiv === undefined)
                throw new Error(`GitHub-Repos-WebCards: Error in putData(). Invalid args received.`);
            let userData = repoData.owner;
            userData.userString = userData.login.toLowerCase();
        
            function appendTextContent(selector, content) {
                const elements = cardDiv.querySelectorAll(selector);
                elements.forEach(element => {
                    element.textContent += content;
                });
            }
        
            function setAttribute(selector, attr, value) {
                const elements = cardDiv.querySelectorAll(selector);
                elements.forEach(element => {
                    element.setAttribute(attr, value);
                });
            }
        
            appendTextContent(".gh-repos-cards-name", repoData.name);
            setAttribute(".gh-repos-cards-avatar", "src", userData.avatar_url);
            appendTextContent(".gh-repos-cards-username", userData.userString);
            appendTextContent(".gh-repos-cards-description", repoData.description || "");
        
            const topicsContainers = cardDiv.querySelectorAll(".gh-repos-cards-topics");
            topicsContainers.forEach(topicsContainer => {
                if (repoData.repoTopics && repoData.repoTopics.length > 0) {
                    topicsContainer.innerHTML += repoData.repoTopics.map(topic => `<li>${topic}</li>`).join('');
                }
            });
            
            const languagesContainers = cardDiv.querySelectorAll(".gh-repos-cards-languages");
            languagesContainers.forEach(languagesContainer => {
                if (repoData.repoLanguages && Object.keys(repoData.repoLanguages).length > 0) {
                    const sortedLanguages = Object.keys(repoData.repoLanguages)
                        .sort((a, b) => repoData.repoLanguages[b] - repoData.repoLanguages[a]);
                    languagesContainer.innerHTML += sortedLanguages.map(lang => `<li>${lang}</li>`).join('');
                }
            });
        
            appendTextContent(".gh-repos-cards-stars", String(repoData.repoStars));
            if (repoData.repoWatchers !== undefined && repoData.repoWatchers !== null)
                appendTextContent(".gh-repos-cards-watchers", String(repoData.repoWatchers));
            appendTextContent(".gh-repos-cards-updatedat", repoData.repoUpdatedAt);
            appendTextContent(".gh-repos-cards-forks", String(repoData.repoForks));
        }

        function apiErrorMessage(query, response) {
            const remaining = response.headers.get("X-RateLimit-Remaining");
            if ((response.status === 403 || response.status === 429) && remaining === "0") {
                const reset = Number(response.headers.get("X-RateLimit-Reset"));
                let when = "";
                if (Number.isFinite(reset) && reset > 0) {
                    const resetDate = new Date(reset * 1000);
                    const minutes = Math.max(1, Math.ceil((resetDate.getTime() - new Date().getTime()) / 60000));
                    when = ` It will be reset at ${resetDate.toLocaleTimeString()} (about ${minutes} minute(s) from now).`;
                }
                return `GitHub-Repos-WebCards: GitHub's APIs rate limit exceeded on '${query}'. ` +
                       `Unauthenticated requests are limited to 60/hour per public IP.${when} ` +
                       `Keep the cache enabled with GHRepoCardsInit(true) and reduce the number of ` +
                       `<gh-repos-cards> tags and of the requested data fields.`;
            }
            return `GitHub-Repos-WebCards: GitHub's APIs request error on '${query}'! Status: ${response.status}.`;
        }
        
        async function getData(query) {
            let response;
            try {
                response = await fetch(GITHUB_API_ENDPOINT + query, GITHUB_API_SETTINGS);
            } catch (error) {
                throw new Error(`GitHub-Repos-WebCards: Network error in getData() on '${query}': ${error.message}.`);
            }
            if (!response.ok)
                throw new Error(apiErrorMessage(query, response));
            return await response.json();
        }
        
        async function getAllRepos(userString, sortString, fields) {

            if (userString === undefined || sortString === undefined)
                throw new Error(`GitHub-Repos-WebCards: Error in getAllRepos(). Invalid args received.`);

            fields = fields || { languages: true, watchers: true };

            if (ENABLE_CACHING) {
                const cachedNames = getListLocal(userString);
                if (cachedNames) {
                    const localRepos = getDataLocal();
                    const userRepos = {};
                    let complete = true;
                    for (const name of cachedNames) {
                        if (!cachedEntryIsUsable(localRepos[name], userString, fields)) {
                            complete = false;
                            break;
                        }
                        userRepos[name] = localRepos[name];
                    }
                    // A partial cache is not served, otherwise a download interrupted by an
                    // error would keep showing an incomplete list until its expiration.
                    if (complete) {
                        userRepos["%reDownloaded"] = false;
                        return userRepos;
                    }
                }
            }

            let allRepos = [];
            let page = 1;

            // Even when the cached list is incomplete, the repos already saved in it are
            // reused, so a download retried after an error doesn't start again from zero.
            const alreadyCached = ENABLE_CACHING ? getDataLocal() : {};

            while (true) {
                let repos = await getData(`users/${userString}/repos?per_page=${PER_PAGE}&page=${page}${sortString}`);
                if (repos.length === 0) break;

                const pageRepos = await mapWithLimit(repos, async (repo) => {
                    const cached = alreadyCached[repo.name.toLowerCase()];
                    if (cachedEntryIsUsable(cached, userString, fields)) return cached.repoData;

                    // 'topics' is already included in this response, no request needed for it.
                    // 'subscribers_count' (the real watchers count) is not, it only exists in the
                    // single repo's response, so it costs one more request and it's asked
                    // only if the card really shows it.
                    const [languages, fullRepo] = await Promise.all([
                        fields.languages ? getData(`repos/${userString}/${repo.name}/languages`) : Promise.resolve(undefined),
                        fields.watchers ? getData(`repos/${userString}/${repo.name}`) : Promise.resolve(undefined)
                    ]);

                    const repoData = {
                        ...repo,
                        repoStars: repo.stargazers_count,
                        repoUpdatedAt: repo.updated_at,
                        repoForks: repo.forks_count,
                        repoTopics: Array.isArray(repo.topics) ? repo.topics : [],
                        repoLanguages: fields.languages ? (languages || {}) : undefined,
                        repoWatchers: fields.watchers ? fullRepo.subscribers_count : undefined
                    };

                    // Saved as soon as it's downloaded: if a following repo fails, what has
                    // been already downloaded is not lost and it's not downloaded again.
                    saveDataLocal(repoData);
                    return repoData;
                });

                allRepos.push(...pageRepos);
                // The last page is shorter than the asked size, so asking for the next one
                // would only be a wasted request.
                if (repos.length < PER_PAGE) break;
                page++;
            }

            saveListLocal(userString, allRepos.map(e => e.name.toLowerCase()));
        
            let objAllRepos = {};
            allRepos.forEach((e) => {
                objAllRepos[e.name.toLowerCase()] = {
                    repoData: e,
                    expiry: 1
                }
            });
            objAllRepos["%reDownloaded"] = true;
            return objAllRepos;
        }
        
        async function getSingleRepo(userString, repoString, fields) {

            if (userString === undefined || repoString === undefined)
                throw new Error(`GitHub-Repos-WebCards: Error in getSingleRepo(). Invalid args received.`);

            fields = fields || { languages: true, watchers: true };

            if (ENABLE_CACHING) {
                let localRepos = getDataLocal();
                let localRepo = localRepos[repoString];
                if (cachedEntryIsUsable(localRepo, userString, fields)) {
                    localRepo["%reDownloaded"] = false;
                    return localRepo;
                } 
            }

            // The single repo's response already contains 'topics' and 'subscribers_count',
            // so only the languages may need one more request.
            const repo = await getData(`repos/${userString}/${repoString}`);
            const languages = fields.languages ? await getData(`repos/${userString}/${repoString}/languages`) : undefined;
    
            let repoData = {
                ...repo,
                repoStars: repo.stargazers_count,
                repoUpdatedAt: repo.updated_at,
                repoForks: repo.forks_count,
                repoTopics: Array.isArray(repo.topics) ? repo.topics : [],
                repoLanguages: fields.languages ? (languages || {}) : undefined,
                repoWatchers: repo.subscribers_count
            };
                
            return {
                repoData: repoData,
                expiry: 1,
                "%reDownloaded" : true
            };
        }

        // processGHRepoCards() function start.

        // With the cache disabled a previously setted cache must not be left behind.
        if (!ENABLE_CACHING) clearDataLocal(null);

        let cardsElements = [...document.getElementsByTagName("gh-repos-cards")];

        if (cardsElements.length == 0) {
            console.warn(`GitHub-Repos-WebCards: No <gh-repos-cards> tag found.`);
            return;
        }

        // Giving priority to %all.
        cardsElements.sort((a, b) => {
            const repoA = a.getAttribute('data-repo');
            const repoB = b.getAttribute('data-repo');
            if (repoA === '%all') return -1;
            if (repoB === '%all') return 1;
            return repoA.localeCompare(repoB);
        });

        const errors = [];

        for (let cardTag of cardsElements) {
            const userString = cardTag.getAttribute("data-user")?.toLowerCase();
            const repoString = cardTag.getAttribute("data-repo")?.toLowerCase();

            if (!userString)
                throw new Error(`GitHub-Repos-WebCards: Invalid 'data-user' attribute in <gh-repos-cards> tag.`);
            if (!repoString)
                throw new Error(`GitHub-Repos-WebCards: Invalid 'data-repo' attribute in <gh-repos-cards> tag.`);

            let cardDiv = cardTag.querySelectorAll(".gh-repos-cards-div");
            if (!cardDiv || cardDiv.length != 1) {
                throw new Error(`GitHub-Repos-WebCards: Exactly 1 div with the class 'gh-repos-cards-div' in <gh-repos-cards> tag must be present.`);
            }
            cardDiv = cardDiv[0];

            const fields = neededFields(cardDiv);

            // Each card is downloaded independently: a card failing (a network problem or the
            // GitHub's APIs rate limit, for example) must not leave all the other ones empty.
            try {

                if (repoString === "%all") {
                    // All repos.
                    const reposort = cardTag.getAttribute("data-sort")?.toLowerCase();
                    const directionsort = cardTag.getAttribute("data-direction")?.toLocaleLowerCase();
                    let sortString = "";

                    if (reposort) {
                        const admittedsort = ['created', 'updated', 'pushed', 'full_name'];
                        const admitteddirection = ['asc', 'desc'];
                        
                        if (!admittedsort.includes(reposort))
                            throw new Error(`GitHub-Repos-WebCards: Invalid 'data-sort' attribute. Must be one of: ${admittedsort.join(', ')}.`);
                        if (directionsort && !admitteddirection.includes(directionsort))
                            throw new Error(`GitHub-Repos-WebCards: Invalid 'data-direction' attribute. Must be one of: ${admitteddirection.join(', ')}.`);

                        sortString = `&sort=${reposort}&direction=${directionsort}`;
                    }

                    let repos = await getAllRepos(userString, sortString, fields);
                    delete repos["%reDownloaded"];

                    const originalContent = cardDiv.innerHTML;

                    Object.values(repos).map(e => e.repoData).forEach((repoFromList, index) => {
                        const newCardDiv = cardDiv.cloneNode(true);
                        newCardDiv.innerHTML = originalContent;
                        putData(repoFromList, newCardDiv);
                        
                        if (index === 0) {
                            cardDiv.innerHTML = newCardDiv.innerHTML;
                        } else {
                            cardTag.appendChild(newCardDiv);
                        }
                    });

                } else {
                    // Single repo.
                    const repoData = await getSingleRepo(userString, repoString, fields);
                    const reDownloaded = repoData["%reDownloaded"];
                    delete repoData["%reDownloaded"];
                    if (reDownloaded)
                        saveDataLocal(repoData.repoData);
                    putData(repoData.repoData, cardDiv);
                }

                cardTag.style = "";

            } catch (error) {
                // The tag is left hidden, an half filled card is worse than no card at all.
                errors.push(error);
                console.error(`GitHub-Repos-WebCards: the card '${userString}/${repoString}' has not been filled. ${error.message}`);
            }

        }

        // Export functions to call it directly outside if needed, basic APIs.
        processGHRepoCards.saveDataLocal = saveDataLocal;
        processGHRepoCards.getDataLocal = getDataLocal;
        processGHRepoCards.clearDataLocal = clearDataLocal;
        processGHRepoCards.putData = putData;
        processGHRepoCards.getData = getData;
        processGHRepoCards.getAllRepos = getAllRepos;
        processGHRepoCards.getSingleRepo = getSingleRepo;
        // The errors of the cards that could not be filled, empty array if all went fine.
        processGHRepoCards.errors = errors;

        return processGHRepoCards;

    }

    const wrapperInternalInitGHRepoCards = () => {
        let hasBeenCalled = false;

        const singleCallChecker = async function(param) {

            if (param === undefined || typeof param !== 'boolean')
                throw new Error(`GitHub-Repos-WebCards: GHRepoCardsInit(ENABLE_CACHING) must take as arg a boolean. True to enable the cache system, false otherwise.`);

            if (hasBeenCalled)
                throw new Error(`GitHub-Repos-WebCards: Do not call GHRepoCardsInit() multiple times, an error has been generated to prevent undefined behaviours.`);

            hasBeenCalled = true;

            const executeFunction = await processGHRepoCards(param); 

            // Final returned object.
            return executeFunction;

        };

        return singleCallChecker;
    };

    return () => {
        return wrapperInternalInitGHRepoCards();
    };

})()();
