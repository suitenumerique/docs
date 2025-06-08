"""Test util base64_yjs_to_text."""

import base64
import uuid

import pycrdt

from core import utils

# This base64 string is an example of what is saved in the database.
# This base64 is generated from the blocknote editor, it contains
# the text \n# *Hello* \n- w**or**ld
TEST_BASE64_STRING = (
    "AR717vLVDgAHAQ5kb2N1bWVudC1zdG9yZQMKYmxvY2tHcm91cAcA9e7y1Q4AAw5ibG9ja0NvbnRh"
    "aW5lcgcA9e7y1Q4BAwdoZWFkaW5nBwD17vLVDgIGBgD17vLVDgMGaXRhbGljAnt9hPXu8tUOBAVI"
    "ZWxsb4b17vLVDgkGaXRhbGljBG51bGwoAPXu8tUOAg10ZXh0QWxpZ25tZW50AXcEbGVmdCgA9e7y"
    "1Q4CBWxldmVsAX0BKAD17vLVDgECaWQBdyQwNGQ2MjM0MS04MzI2LTQyMzYtYTA4My00ODdlMjZm"
    "YWQyMzAoAPXu8tUOAQl0ZXh0Q29sb3IBdwdkZWZhdWx0KAD17vLVDgEPYmFja2dyb3VuZENvbG9y"
    "AXcHZGVmYXVsdIf17vLVDgEDDmJsb2NrQ29udGFpbmVyBwD17vLVDhADDmJ1bGxldExpc3RJdGVt"
    "BwD17vLVDhEGBAD17vLVDhIBd4b17vLVDhMEYm9sZAJ7fYT17vLVDhQCb3KG9e7y1Q4WBGJvbGQE"
    "bnVsbIT17vLVDhcCbGQoAPXu8tUOEQ10ZXh0QWxpZ25tZW50AXcEbGVmdCgA9e7y1Q4QAmlkAXck"
    "ZDM1MWUwNjgtM2U1NS00MjI2LThlYTUtYWJiMjYzMTk4ZTJhKAD17vLVDhAJdGV4dENvbG9yAXcH"
    "ZGVmYXVsdCgA9e7y1Q4QD2JhY2tncm91bmRDb2xvcgF3B2RlZmF1bHSH9e7y1Q4QAw5ibG9ja0Nv"
    "bnRhaW5lcgcA9e7y1Q4eAwlwYXJhZ3JhcGgoAPXu8tUOHw10ZXh0QWxpZ25tZW50AXcEbGVmdCgA"
    "9e7y1Q4eAmlkAXckODk3MDBjMDctZTBlMS00ZmUwLWFjYTItODQ5MzIwOWE3ZTQyKAD17vLVDh4J"
    "dGV4dENvbG9yAXcHZGVmYXVsdCgA9e7y1Q4eD2JhY2tncm91bmRDb2xvcgF3B2RlZmF1bHQA"
)


def test_utils_base64_yjs_to_text():
    """Test extract text from saved yjs document"""
    assert utils.base64_yjs_to_text(TEST_BASE64_STRING) == "Hello w or ld"


def test_utils_base64_yjs_to_xml():
    """Test extract xml from saved yjs document"""
    content = utils.base64_yjs_to_xml(TEST_BASE64_STRING)
    assert (
        '<heading textAlignment="left" level="1"><italic>Hello</italic></heading>'
        in content
        or '<heading level="1" textAlignment="left"><italic>Hello</italic></heading>'
        in content
    )
    assert (
        '<bulletListItem textAlignment="left">w<bold>or</bold>ld</bulletListItem>'
        in content
    )


def test_utils_extract_attachments():
    """
    All attachment keys in the document content should be extracted.
    """
    document_id = uuid.uuid4()
    image_key1 = f"{document_id!s}/attachments/{uuid.uuid4()!s}.png"
    image_url1 = f"http://localhost/media/{image_key1:s}"

    image_key2 = f"{uuid.uuid4()!s}/attachments/{uuid.uuid4()!s}.png"
    image_url2 = f"http://localhost/{image_key2:s}"

    image_key3 = f"{uuid.uuid4()!s}/attachments/{uuid.uuid4()!s}.png"
    image_url3 = f"http://localhost/media/{image_key3:s}"

    ydoc = pycrdt.Doc()
    frag = pycrdt.XmlFragment(
        [
            pycrdt.XmlElement("img", {"src": image_url1}),
            pycrdt.XmlElement("img", {"src": image_url2}),
            pycrdt.XmlElement("p", {}, [pycrdt.XmlText(image_url3)]),
        ]
    )
    ydoc["document-store"] = frag

    update = ydoc.get_update()
    base64_string = base64.b64encode(update).decode("utf-8")
    # image_key2 is missing the "/media/" part and shouldn't get extracted
    assert utils.extract_attachments(base64_string) == [image_key1, image_key3]
