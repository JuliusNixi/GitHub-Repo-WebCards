# GitHub-Repos-WebCards
Easily create custom web cards containing GitHub's repositories data.

## What and why?
During the development of my new static (without backend) blog/website, I wanted to include some data from my coding projects. Since they are hosted on GitHub, I thought it would be best to get the data automatically from GitHub through its APIs, instead of having to manually update the data each time. I looked for projects that did this, but found few resources and almost all of them were very dated. Others had a fixed theme that did not integrate with the style of my site and they were not showing the data I wanted. So I decided to write a small script myself, and hoping it will be useful, I leave it available here for everyone.

## Is it really needed? What does it add to the GitHub's APIs?
Sincerely no, it's not something of unique and special. Is simply a wrapper of the GitHub's APIs and doesn't add anything to them. However, I think it can be common to want to pull data from GitHub, for example in developer portfolios. It is, of course, possible to make all the desired requests manually from scratch, but this requires some effort and tedium. This project hopes to provide something, while simple, that is workable and provides a stable baseline allowing you to not reinvent the wheel if you only want some basic repo statistics. **It is not meant for complex projects that require sophisticated interactions with GitHub's APIs.**

## Demo
A demo is avaible [here](https://juliusnixi.github.io/GitHub-Repos-WebCards/). The 'index.html' showed is this repo file hosted on GitHub pages.

## Styles and frameworks agnostic
A key concept of the project is the style and framework agnosticism. In fact, I want anyone to be able to take the data and decide what style to use with them and on what frontend framework. In the future, could be added some default themes, but freedom from styling and tech stack will always be central.

## Autenthication/Backend less/GitHub's APIs rate limit
The GitHub's APIs could be used with or without authentication. In the second case, how you can [see](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api?apiVersion=2022-11-28), the requests are limited to 60/hour per public IP. Since this script is vanilla javascript that runs on the client, in the first case, the GitHub's APIs personal auth token would be exposed and this could be dangerous and cannot be avoided. To solve this problem a backend solution must be implemented. However, as said before, the idea was to stay more general and simply as possible on the client side, so no GitHub's APIs auth is used, but to prevent to easy hit the rate limit a caching system is present.

### How many requests does a card cost?
Since the rate limit is counted in requests, the script asks the GitHub's APIs **only for the data that your card really shows**, looking at which classes (see the "Available data" section) are present in your `gh-repos-cards-div`. This is the cost:
* Single repo mode: **1** request, **+1** if the card shows the languages (`gh-repos-cards-languages`).
* All repos (`%all`) mode: **1** request for the repos list (every 100 repos), then for each repo **+1** if the card shows the languages and **+1** if it shows the watchers (`gh-repos-cards-watchers`).

The owner's avatar, the username, the repo's name, description, topics, stars, forks and update date are all already contained in the responses above, so they are free. The watchers count in `%all` mode is the only one that costs an extra request, because the repos list response doesn't contain it (note that the `watchers_count` field returned there is not the watchers count, it's a duplicate of the stars count, so it cannot be used).

## Caching
The script (to prevent GitHub's API's rate limit, read above) has a caching system. Its use is optional but strongly recommended, because without it, with some use of this script and a few page reloads from the website viewer, it is easy to suffer the limitation of the GitHub's APIs and fail to get and show the data to the website viewer. With the cache system enabled all the data received about a repository (and the respository's name), as a response to a request, are saved in the local storage. When a new request about the specified same repository is made again, the data are served from the internal cache, without querying again the GitHub's APIs. The cache has an expiration date, to keep the informations updated.
In `%all` mode every repo is saved as soon as it's downloaded, so a download interrupted halfway (by the rate limit, for example) is not lost and the repos already saved are not downloaded again on the next page load. The list of the repos composing an owner's `%all` is saved apart (under the `%all:OWNER` key, and `%` is not an admitted character in a repo's name, so no collision is possible), so that an incomplete list is never served as if it was complete.

## Installation
Two possibility:
* Download the javascript vanilla script from here to serve it with your site's assets, so you are independent.
* Serve it through a CDN in this way (thanks to [jsDelivr](https://www.jsdelivr.com)):
```html
<script src="https://cdn.jsdelivr.net/gh/juliusnixi/GitHub-Repos-WebCards@2.1.0/ghreposcards.js"></script>
```

## Setup
Also here two ways:
* Get data from a specific single repo and its owner.
```html
    <gh-repos-cards
    style="display: none;"
    data-user="GITHUB-USERNAME"
    data-repo="GITHUB-REPO-NAME">

        <div
        class="gh-repos-cards-div">

            <p> ...Optional content... </p>
            <!-- ... DESIRED DATA HERE (SEE BELOW) ... -->

        </div>

    </gh-repos-cards>
```
* Get ALL the repositories data from a GitHub owner.
```html
    <gh-repos-cards
    style="display: none;"
    data-user="GITHUB-USERNAME"
    data-repo="%all"
    data-sort="created"
    data-direction="desc">

        <div
        class="gh-repos-cards-div">

            <p> ...Optional content... </p>
            <!-- ... DESIRED DATA HERE (SEE BELOW) ... -->

        </div>

    </gh-repos-cards>
```
### All repositories args explaination
Note here the `data-repo="%all"`. '%' is not an admitted character for the GitHub repository name, so there is no danger of conflict if you wanted to get a single repository with that name, it cannot exists on GitHub.
The `data-sort="created"` and the `data-direction="desc"` attributes are used only in this all mode, otherwise ignored. They are optional, if both not present, the order of the respositories is undefined (random). If the first is present but not the second, an error is throw. If the second is present, but not the first, the second is ignored and no sort is applied. `data-sort` could be one from `['created', 'updated', 'pushed', 'full_name']`. `data-direction` could be one from `['asc', 'desc']`. In this mode the script will clone the `gh-repos-cards-div` and all its content, there will be a new one (copy) for each repo. So in the example above all the repos will have the `<p>` at the beginning.

## General explaination for both modes
* The data will be injected in every `<gh-repos-cards>`.
* The `style="display: none;"` is optional, but recommended, it will automatically removed from this script after the data injection to prevent showing empty html structure to the website viewer during the data download. So **don't use inline CSS on this tag**.
* In each `<gh-repos-cards>` exactly 1 `<div>` with at least the `gh-repos-cards-div` class must be present, otherwise an error is throw. All the html strcture to contain the desired data (see below) must be in this div, otherwise their won't be filled.
* The `data-user` and `data-repo` attributes in the `<gh-repos-cards>` must be present and setted respectively to the desired GitHub repository owner and to his repository's name.
* Every `<gh-repos-cards>` tag is downloaded and filled independently from the others. If the download of one of them fails (a network problem or the GitHub's APIs rate limit, for example), the error is logged in the console, that tag is left hidden and untouched, and all the other ones are filled anyway. The failures are also collected in the `errors` array of the returned object (see "Basic APIs" below), that is empty when everything went fine. The configuration errors (a wrong attribute, a missing div) are instead thrown immediately as before.

## Usage
Wherever and whenever you want simply call the javascript function `GHRepoCardsInit(ENABLE_CACHING)`. The function **must be called only once**, otherwise an error is throw to avoid undefined behaviours. The function must take as arg a boolean. True to enable the cache system, false otherwise. If the cache is disabled, if a cache has been previously setted, it will be cleared. The function will fill all the `gh-repos-cards-div` in the `<gh-repos-cards>` tags with the requested data.

## Available data
```html
<p> Owner's avatar <img width="50px" height="50px" class="gh-repos-cards-avatar" /> </p>
<p class="gh-repos-cards-username">Owner's username: </p>
    
<p class="gh-repos-cards-name">Repo's name: </p>
<p class="gh-repos-cards-description">Repo's description: </p>
<ul class="gh-repos-cards-topics">Repo's topics: </ul>
<ul class="gh-repos-cards-languages">Repo's languages: </ul>
<p class="gh-repos-cards-stars">Repo's stars: </p>
<p class="gh-repos-cards-watchers">Repo's watchers: </p>
<p class="gh-repos-cards-updatedat">Repo updated at: </p>
<p class="gh-repos-cards-forks">Repo's forks: </p>
```
Put the desired html data structure (choosing from the above list) inside the `gh-repos-cards-div`. The Topics and the Languages are injected inside the `<ul>` as `<li>`.

## Basic APIs
The functions that compose the script are also avaible as APIs to be called outside the script to allow you to take advantage of them if you need to develop your own custom features. However, if you think these might be useful to everyone you might consider collaborating directly on this repo. To use them see this example:
```javascript
GHRepoCardsInit(true).then(result => {
    // Use APIs functions here.
    // Optionally here you can also process the data injected however you want.
    result.getData(`users/octocat/followers`).then(e => console.log(e));
});
```
Note that here we take advantage of the `getData()` function to download data that the script itself doesn't get. For all avaible GitHub's APIs endpoints refer [here](https://docs.github.com/en/rest?apiVersion=2022-11-28). Here's the list, signatures and infos on the script's APIs:
* `function clearDataLocal(repoName)` : Pass `null` to clear all the repos data saved in the cache. Otherwise, pass the specific repo's name as string to remove it from the cache.
* `function saveDataLocal(repoData)` : Pass the repo object to save in the local cache. `repoData` is a `{}` rapresenting [this](https://docs.github.com/en/rest/repos/repos?apiVersion=2022-11-28#get-a-repository) response from GitHub's APIs. If the repo is already present, it's overwritten with a new expiry.
* `function getDataLocal()` : Returns an object `{}` containing for each repo name (lowercased) as key an another object as value with `repoData` and `expiry` keys. `repoData` is a `{}` rapresenting [this](https://docs.github.com/en/rest/repos/repos?apiVersion=2022-11-28#get-a-repository) response from GitHub's APIs. `expiry` contains when the data will be invalidated from the cache and redownloaded. It's this function that when called checks if the data contained in the cache are expired and if so, delete them before returning.
* `function putData(repoData, cardDiv)` : Pass the object containing the repo's data to inject in the html structures contained in the `cardDiv`. `repoData` is a `{}` rapresenting [this](https://docs.github.com/en/rest/repos/repos?apiVersion=2022-11-28#get-a-repository) response from GitHub's APIs. `cardDiv` must be an html div element with at least the `gh-repos-cards-div` class.
* `async function getData(query)` : Pass the query as string. It's the GitHub's API desired endpoint. It's the part of string after `https://api.github.com/`. So this prefix it's prefixed by the function, don't pass it. Its returned value depends from the GitHub's APIs.
* `async function getAllRepos(userString, sortString, fields)` : Pass the GitHub owner username as string. Pass as `sortString` something like `sortString = "&sort=REPOSORT&direction=SORTDIRECTION`, the capsed params are explained above in the "All repositories args explaination" section. `fields` is optional, it's a `{}` like `{languages: true, watchers: true}` telling which of the two data costing an extra request per repo must be downloaded, if omitted both are. The ones not downloaded are left `undefined` in the returned repo object. The data are saved in the cache (if enabled) page by page while they are downloaded. The returned value is like `getDataLocal()`. Here `expiry` is not significant since the data could be getted from cache (if enabled and so with a valid expiry) or redownloaded otherwise.
* `async function getSingleRepo(userString, repoString, fields)` : Pass the GitHub repo owner's username as string. Pass the GitHub repo's name as string. `fields` is optional and works like in `getAllRepos()`, but here only `languages` costs an extra request. No data are saved in the cache, make it you if you want. The returned value is like `getDataLocal()`. Here `expiry` is not significant since the data could be getted from cache (if enabled and so with a valid expiry) or redownloaded otherwise.
* `errors` : Not a function, it's an array containing the `Error` objects of the `<gh-repos-cards>` tags that could not be filled. It's empty if all of them have been filled correctly.


