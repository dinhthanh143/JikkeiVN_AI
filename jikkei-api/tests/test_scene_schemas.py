from app.schemas.scene import SceneUpdateRequest


def test_scene_update_accepts_cover_only_payload() -> None:
    payload = SceneUpdateRequest(scene_cover="https://example.com/cover.png")

    assert payload.scene_cover == "https://example.com/cover.png"
    assert payload.model_fields_set == {"scene_cover"}


def test_scene_update_tracks_explicit_description_clear() -> None:
    payload = SceneUpdateRequest(description=None)

    assert payload.description is None
    assert payload.model_fields_set == {"description"}
