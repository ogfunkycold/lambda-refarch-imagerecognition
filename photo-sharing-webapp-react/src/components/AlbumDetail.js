import React, {useState, useEffect} from 'react';
import API, {graphqlOperation} from '@aws-amplify/api'

import {Grid, Header, Form, List, Segment} from 'semantic-ui-react'

import {v4 as uuid} from 'uuid';

import * as queries from '../graphql/queries'
import * as mutations from '../graphql/mutations'
import * as subscriptions from '../graphql/subscriptions'
import {Auth} from "aws-amplify";
import {PhotoList, S3ImageUpload} from "./PhotoList";

export const AlbumDetails = (props) => {
  const [album, setAlbum] = useState({name: 'Loading...', photos: []})
  const [photos, setPhotos] = useState([])
  const [hasMorePhotos, setHasMorePhotos] = useState(true)
  const [fetchingPhotos, setFetchingPhotos] = useState(false)
  const [nextPhotosToken, setNextPhotosToken] = useState(null)

  useEffect(() => {
    const loadAlbumInfo = async () => {
      const results = await API.graphql(graphqlOperation(queries.getAlbum, {id: props.id}))
      setAlbum(results.data.getAlbum)
    }

    loadAlbumInfo()
  }, [props.id])

  useEffect(() => {
    fetchNextPhotos()
  }, [])

  useEffect(() => {
    let subscription

    async function setupSubscription() {
      const user = await Auth.currentAuthenticatedUser()
      subscription = API.graphql(graphqlOperation(subscriptions.onCreatePhoto,
        {owner: user.username})).subscribe({
        next: (data) => {
          const photo = data.value.data.onCreatePhoto
          if (photo.albumId !== props.id) return
          setPhotos(p => p.concat([photo]))
        }
      })
    }

    setupSubscription();
    return () => subscription.unsubscribe()
  }, [props.id])

  const fetchNextPhotos = async () => {
    const FETCH_LIMIT = 20
    setFetchingPhotos(true)
    let queryArgs = {
      albumId: props.id,
      limit: FETCH_LIMIT,
      nextToken: nextPhotosToken
    }
    if (!queryArgs.nextToken) delete queryArgs.nextToken
    const results = await API.graphql(graphqlOperation(queries.listPhotosByAlbum, queryArgs))
    setPhotos(p => p.concat(results.data.listPhotosByAlbum.items))
    setNextPhotosToken(results.data.listPhotosByAlbum.nextToken)
    setHasMorePhotos(results.data.listPhotosByAlbum.items.length === FETCH_LIMIT)
    setFetchingPhotos(false)
  }

  return (
    <Segment>
      <Header as='h3'>{album.name}</Header>
      <S3ImageUpload albumId={album.id} />
      <PhotoList photos={photos} />
      {
        hasMorePhotos &&
        <Form.Button
          onClick={() => fetchNextPhotos()}
          icon='refresh'
          disabled={fetchingPhotos}
          content={fetchingPhotos ? 'Loading...' : 'Load more photos'}
        />
      }
    </Segment>
  )
}