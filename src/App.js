import React from 'react';
import { parseStringPromise, Builder } from 'xml2js'
import { Feature } from 'ol';
import * as moment from 'moment';
import { Point } from 'ol/geom';
import { Vector as layerVector } from 'ol/layer';
import { fromLonLat } from 'ol/proj';
import { Vector as sourceVector } from 'ol/source';

import map from './map'
import './App.css';
import { hashCode } from './hashCode';
import { Container, Controls, FileUploader, FileDownloader, Time } from './App.styles';

class App extends React.Component {

  constructor(props) {
    super(props)
    this.state = {
      points: []
    }
    this.uploadRef = React.createRef()
    this.downloadRef = React.createRef()
  }

  getPoints = data => data.gpx.trk[0].trkseg[0].trkpt

  setPoints = (data, pointMapper) => ({
    ...data,
    gpx: {
      ...data.gpx,
      trk: [{
        ...data.gpx.trk[0],
        trkseg: [{
          ...data.gpx.trk[0].trkseg[0],
          trkpt: data.gpx.trk[0].trkseg[0].trkpt.map(pointMapper)
        }]
      }]
    }
  })

  onFileChange = e => {
    const reader = new FileReader();
    reader.onload = () => parseStringPromise(reader.result).then(data => {
      this.key = hashCode(reader.result)
      const backup = sessionStorage.getItem(this.key)
      if (backup) {
        const points = JSON.parse(backup)
        this.setState({ data: this.setPoints(data, (p, i) => points[i]) })
      }
      else {
        this.getPoints(data).forEach(p => p.time = 0)
        this.setState({ data })
      }

      this.setSelectedPointIndex(0)
    })
    reader.readAsText(e.currentTarget.files[0]);
  }

  onSave = () => sessionStorage.setItem(this.key, JSON.stringify(this.getPoints(this.state.data)))

  onFileDownload = () => {
    const now = moment()
    const data = this.setPoints(this.state.data, p => ({
      ...p,
      time: now.clone().add(p.time, 's').toISOString()
    }))
    const xml = new Builder({}).buildObject(data)
    this.downloadRef.current.href = 'data:application/xml;base64,' + btoa(xml)
    this.downloadRef.current.click()
  }

  onFileUpload = () => this.uploadRef.current.click()

  setSelectedPointIndex = index => {
    this.setState({ selectedPointIndex: index })
    const view = map.getView()
    view.setZoom(17)
    const { lon, lat } = this.getPoints(this.state.data)[index].$
    const point = fromLonLat([lon, lat])
    view.setCenter(point)
    if (!this.feature) {
      this.feature = new Feature()
      map.addLayer(new layerVector({
        source: new sourceVector({
          features: [this.feature]
        })
      }));
    }
    this.feature.setGeometry(new Point(point))
  }

  offsetPoint = (index, offset) => this.setState(ps => ({
    data: this.setPoints(ps.data, (p, i) => i < index ? p : {
      ...p,
      time: p.time + offset
    })
  }))

  formatSeconds = v => {
    const m = Math.floor(v / 60)
    const s = v % 60
    return (m > 0 ? `${m}m ` : '') + `${s}s`
  }

  render() {
    const { data, selectedPointIndex } = this.state
    const points = data !== undefined ? this.getPoints(data) : []

    return (
      <Container>
        <Controls>
          {points.length ?
            <>
              <button type="button" className="btn btn-primary" onClick={this.onFileDownload}>Download GPX file</button>
              <button type="button" className="btn btn-primary" onClick={this.onSave}>Save</button>
            </> :
            <button type="button" className="btn btn-primary" onClick={this.onFileUpload}>Upload GPX file</button>}
        </Controls>
        <ul>
          {points.map((p, i) => <li key={i} onClick={() => this.setSelectedPointIndex(i)} className={`row ${selectedPointIndex === i ? ' selected' : ''} `}>
            <div>
              <span className="badge badge-pill badge-light">{i + 1}</span>
            </div>
            <div className="btn-group" role="group" aria-label="Basic example">
              <button type="button" className="btn btn-secondary" onClick={() => this.offsetPoint(i, -5)}>-5</button>
              <button type="button" className="btn btn-secondary" onClick={() => this.offsetPoint(i, -1)}>-1</button>
            </div>
            <div>
              <Time className="badge badge-info">{this.formatSeconds(p.time)}</Time>
            </div>
            <div className="btn-group" role="group" aria-label="Basic example">
              <button type="button" className="btn btn-secondary" onClick={() => this.offsetPoint(i, 1)}>+1</button>
              <button type="button" className="btn btn-secondary" onClick={() => this.offsetPoint(i, 5)}>+5</button>
            </div>
          </li>)}
        </ul>
        <FileUploader type="file" accept=".gpx" onChange={this.onFileChange} ref={this.uploadRef} />
        <FileDownloader ref={this.downloadRef} download="result.gpx" />
      </Container>
    );
  }
}

export default App;
