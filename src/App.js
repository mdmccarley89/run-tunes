import React, { Component } from 'react';

import ToggleSearchButton from './components/ToggleSearchButton';
import Search from './components/Search/Search';
import ConnectWithSpotify from './components/ConnectWithSpotify';
import Seeds from './components/Seeds/Seeds';
import TrackList from './components/TrackList';
import Player from './components/Player';

import {debounce} from 'lodash';
import {getHashParams} from './lib/helpers';
import {
  setAuthToken,
  collectTrackIdsFromSeeds,
  getUserInfo,
  getTopTracks,
  getTopArtists,
  getRecommendations,
  getSpotifyDevices,
  sendTracksToDevice,
  createPlaylist,
  addTracksToPlaylist,
  getAudioAnalysisForTrack} from './lib/spotifyApi';

class App extends Component {
  constructor(props) {
    super(props);

    this.state = {
      isAuthenticated: false,
      accessToken: getHashParams().access_token,
      
      spotifyUserInfo: null,
      
      isSearching: false,

      topTracks: null,
      topArtists: null,

      trackSeeds: [],
      artistSeeds: [],
      albumSeeds: [],
      playlistSeeds: [],
      seedCount: 0,

      recommendations: [],

      recommendedTrackList: null,
      trackListDuration: 0,

      devices: [],
      chosenDevice: null,

      playlistName: null,
      playlistInfo: null,
    };

    this.toggleSearching = this.toggleSearching.bind(this);
    this.handleSeedRemoval = this.handleSeedRemoval.bind(this);
    this.handleSeedSelection = this.handleSeedSelection.bind(this);

    this.handleGettingSpotifyDevices = this.handleGettingSpotifyDevices.bind(this);
    this.handleSelectingDevice = this.handleSelectingDevice.bind(this);
    this.handleSendingTracksToDevice = this.handleSendingTracksToDevice.bind(this);

    this.buildRecommendationsOptions = this.buildRecommendationsOptions.bind(this);
    this.handleRecommendations = this.handleRecommendations.bind(this);

    this.getUserInfoFromSpotify = this.getUserInfoFromSpotify.bind(this);

    this.handleUpdatingPlaylistName = this.handleUpdatingPlaylistName.bind(this);
    this.handleCreatingPlaylist = this.handleCreatingPlaylist.bind(this);

    this.getSeedSuggestions = this.getSeedSuggestions.bind(this);

    this.getRecommendationsFromSpotify = debounce(this.getRecommendationsFromSpotify, 500);
    this.getTopTracksFromSpotify = this.getTopTracksFromSpotify.bind(this);
    this.getTopArtistsFromSpotify = this.getTopArtistsFromSpotify.bind(this);

    this.getTrackListDuration = this.getTrackListDuration.bind(this);

  }
  
  componentWillMount() {
    /* 
      remove the params from the url because they should have already been
      grabbed in the constructor
    */
    window.history.pushState({}, document.title, "/");

    // check if the accessToken has been set in state
    if (this.state.accessToken) {
      this.setState({
        isAuthenticated: true,
      });
      setAuthToken(this.state.accessToken);
    } else {
      this.setState({
        isAuthenticated: false,
      });
    }

    if (this.state.accessToken) {
      this.getUserInfoFromSpotify(this.state.accessToken);
    }
    
  }

  async getTopTracksFromSpotify() {
    const shortTermTracks = await getTopTracks(this.state.accessToken);

    this.setState({
      topTracks: shortTermTracks
    });
  }

  async getTopArtistsFromSpotify() {
    const shortTermArtists = await getTopArtists(this.state.accessToken);

    this.setState({
      topArtists: shortTermArtists
    });
  }

  async getUserInfoFromSpotify() {
    const userInfo = await getUserInfo(this.state.accessToken);
    
    this.setState({
      spotifyUserInfo: userInfo
    });
  }

  getSeedSuggestions() {
    if (this.state.topTracks === null) {
      this.getTopTracksFromSpotify();
    }
    
    if (this.state.topArtists === null) {
      this.getTopArtistsFromSpotify();
    }
  }

  toggleSearching() {
    this.setState({
      isSearching: !this.state.isSearching,
    });

    this.getSeedSuggestions();
  }

  handleSeedRemoval(seed, seedType) {
    const seedLocation = `${seedType}Seeds`;
    this.setState(prevState => {
      const newState = {};
      newState[seedLocation] = this.state[seedLocation].filter(item => item.id !== seed.id);
      newState.seedCount = prevState.seedCount - 1;
      this.setState(newState);
      this.handleRecommendations();
    });
  }

  handleSeedSelection(seed, seedType) {
    const seedLocation = `${seedType}Seeds`;
    if (!this.state[seedLocation].includes(seed)) {
      this.setState(prevState => {
        const newState = {};
        newState[seedLocation] = [...prevState[seedLocation], seed];
        newState.isSearching = false;
        newState.seedCount = prevState.seedCount + 1;
        this.setState(newState);
        this.handleRecommendations();
      });
    }
  }

  async buildRecommendationsOptions() {
    const trackIds = await collectTrackIdsFromSeeds(this.state.albumSeeds, this.state.playlistSeeds, this.state.trackSeeds);
    const artistIds = this.state.artistSeeds.map(artist => artist.id);

    const recommendationsOptions = {
      seed_artists: artistIds,
      seed_tracks: trackIds,
      limit: 100
    }

    recommendationsOptions.min_tempo = 180;

    return recommendationsOptions;
  }

  async getRecommendationsFromSpotify() {

    const options = await this.buildRecommendationsOptions();

    if (options.seed_artists.length > 0 || options.seed_tracks.length > 0) {
      const recommendedTrackList = await getRecommendations(this.state.accessToken, options);
      // const trackListDuration = await this.getTrackListDuration(recommendedTrackList.tracks);
      this.setState({
        recommendedTrackList: recommendedTrackList.tracks,
        // trackListDuration: trackListDuration,
      });

    } else {
      this.setState({
        recommendedTrackList: []
      })
    }
  }

  handleRecommendations() {
    this.getRecommendationsFromSpotify();
  }

  async handleGettingSpotifyDevices() {
    const myDevices = await getSpotifyDevices(this.state.accessToken);
    
    this.setState({
      devices: myDevices.devices,
    });
  }

  handleSendingTracksToDevice() {
    const authToken = this.state.accessToken;
    const deviceId = this.state.chosenDevice.id;
    const trackList = this.state.recommendedTrackList.map(track => `spotify:track:${track.id}`);

    sendTracksToDevice(authToken, deviceId, trackList);
  }

  handleSelectingDevice(device) {
    this.setState({
      chosenDevice: {
        id: device.id,
        name: device.name,
      }
    })
  }

  handleUpdatingPlaylistName(event) {
    this.setState({
      playlistName: event.target.value
    });
  }

  async handleCreatingPlaylist() {
    const authToken = this.state.accessToken;
    const userId = this.state.spotifyUserInfo.id;
    const playlistName = this.state.playlistName ? this.state.playlistName : 'playlistify.me';

    const playlistInfo = await createPlaylist(authToken, userId, playlistName);
    
    const playlistId = playlistInfo.id;
    const trackUris = this.state.recommendedTrackList.map(track => `spotify:track:${track.id}`);

    addTracksToPlaylist(authToken, playlistId, trackUris);
  }

  async getTrackListDuration(trackList) {
    const trackIds = trackList.map(track => track.id);
    
    const trackDurations = await Promise.all(trackIds.map(async (trackId) => {
      const authToken = this.state.accessToken;
      const audioAnalysis = await getAudioAnalysisForTrack(authToken, trackId);
      return audioAnalysis.track.duration;
    }));

    return trackDurations.reduce((acc, cur) => {
      return acc + cur;
    }, 0);
  }

  render() {
    return (
      <div>
        <div className="bg-red-light p-4">
          <div className="container mx-auto">
            <h1>runTunes</h1>
          </div>
        </div>
        <div className="relative min-h-screen bg-grey-lighter pt-8">
          <div className="container mx-auto">
          {!this.state.isAuthenticated && 
              <ConnectWithSpotify/>
          }

          {this.state.isAuthenticated &&
            <div>
              <div className="flex mb-4">
                <div className="p-4 bg-white rounded-lg shadow-md w-3/4">
                  {!this.state.isSearching && (
                    <div className="flex flex-col items-center">
                      <Seeds trackSeeds={this.state.trackSeeds}
                        artistSeeds={this.state.artistSeeds}
                        albumSeeds={this.state.albumSeeds}
                        playlistSeeds={this.state.playlistSeeds} 
                        handleSeedRemoval={this.handleSeedRemoval}/>
                      {this.state.seedCount < 5 && (
                        <ToggleSearchButton toggleSearching={this.toggleSearching}/>
                      )}
                    </div>
                  )}

                  { this.state.isSearching && 
                    <Search accessToken={this.state.accessToken}
                      toggleSearching={this.toggleSearching}
                      topTracks={this.state.topTracks}
                      topArtists={this.state.topArtists} 
                      handleSeedSelection={this.handleSeedSelection}/>
                  }
                </div>
                <Player handleGettingSpotifyDevices={this.handleGettingSpotifyDevices}
                  handleSelectingDevice={this.handleSelectingDevice}
                  handleSendingTracksToDevice={this.handleSendingTracksToDevice}
                  devices={this.state.devices}
                  chosenDevice={this.state.chosenDevice}
                  spotifyUserInfo={this.state.spotifyUserInfo}
                  handleUpdatingPlaylistName={this.handleUpdatingPlaylistName} 
                  handleCreatingPlaylist={this.handleCreatingPlaylist} 
                  recommendedTrackList={this.state.recommendedTrackList} 
                  playlistInfo={this.state.playlistInfo} />
              </div>
              <TrackList recommendedTrackList={this.state.recommendedTrackList} 
                trackListDuration={this.state.trackListDuration}/>
            </div>
          }
          </div>
        </div>
      </div>
    );
  }z
}

export default App;
