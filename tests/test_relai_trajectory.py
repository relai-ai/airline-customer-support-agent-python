from airline_support.trajectory import get_recorder


def test_relai_path_precedes_local_path(monkeypatch, tmp_path):
    destination = tmp_path / 'harbor.json'
    monkeypatch.setenv('RELAI_ATIF_TRAJECTORY_PATH', str(destination))
    monkeypatch.setenv('ATIF_TRAJECTORY_PATH', str(tmp_path / 'local.json'))
    recorder = get_recorder(new_session=True)
    recorder.user('Observed Harbor user input')
    assert recorder.path == destination
    assert destination.exists()
    assert not (tmp_path / 'local.json').exists()
