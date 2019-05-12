# Changelog
## [1.0.8] - 2019-05-11
### Added
- `get` param `searchModel[]` for layers (datasets) 

Example

    searchModel[days][0]='30-45'
    searchModel[days][0]='45-60'
    searchModel[days][0]='60-80'
    searchModel[days][0]='80-0'

Module will return main + 4 datasets by query
