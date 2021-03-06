/**
 * @license Copyright (c) 2003-2018, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md.
 */

import ModelTestEditor from '@ckeditor/ckeditor5-core/tests/_utils/modeltesteditor';
import { setData, getData } from '@ckeditor/ckeditor5-engine/src/dev-utils/model';
import { upcastElementToElement } from '@ckeditor/ckeditor5-engine/src/conversion/upcast-converters';

import InsertColumnCommand from '../../src/commands/insertcolumncommand';
import {
	downcastInsertCell,
	downcastInsertRow,
	downcastInsertTable,
	downcastRemoveRow,
	downcastTableHeadingColumnsChange,
	downcastTableHeadingRowsChange
} from '../../src/converters/downcast';
import upcastTable from '../../src/converters/upcasttable';
import { formatTable, formattedModelTable, modelTable } from '../_utils/utils';
import TableUtils from '../../src/tableutils';

describe( 'InsertColumnCommand', () => {
	let editor, model, command;

	beforeEach( () => {
		return ModelTestEditor.create( {
			plugins: [ TableUtils ]
		} ).then( newEditor => {
			editor = newEditor;
			model = editor.model;

			const conversion = editor.conversion;
			const schema = model.schema;

			schema.register( 'table', {
				allowWhere: '$block',
				allowAttributes: [ 'headingRows' ],
				isObject: true
			} );

			schema.register( 'tableRow', { allowIn: 'table' } );

			schema.register( 'tableCell', {
				allowIn: 'tableRow',
				allowContentOf: '$block',
				allowAttributes: [ 'colspan', 'rowspan' ],
				isLimit: true
			} );

			model.schema.register( 'p', { inheritAllFrom: '$block' } );

			// Table conversion.
			conversion.for( 'upcast' ).add( upcastTable() );
			conversion.for( 'downcast' ).add( downcastInsertTable() );

			// Insert row conversion.
			conversion.for( 'downcast' ).add( downcastInsertRow() );

			// Remove row conversion.
			conversion.for( 'downcast' ).add( downcastRemoveRow() );

			// Table cell conversion.
			conversion.for( 'downcast' ).add( downcastInsertCell() );

			conversion.for( 'upcast' ).add( upcastElementToElement( { model: 'tableCell', view: 'td' } ) );
			conversion.for( 'upcast' ).add( upcastElementToElement( { model: 'tableCell', view: 'th' } ) );

			// Table attributes conversion.
			conversion.attributeToAttribute( { model: 'colspan', view: 'colspan' } );
			conversion.attributeToAttribute( { model: 'rowspan', view: 'rowspan' } );

			conversion.for( 'downcast' ).add( downcastTableHeadingColumnsChange() );
			conversion.for( 'downcast' ).add( downcastTableHeadingRowsChange() );
		} );
	} );

	afterEach( () => {
		return editor.destroy();
	} );

	describe( 'order=after', () => {
		beforeEach( () => {
			command = new InsertColumnCommand( editor );
		} );

		describe( 'isEnabled', () => {
			it( 'should be false if wrong node', () => {
				setData( model, '<p>foo[]</p>' );
				expect( command.isEnabled ).to.be.false;
			} );

			it( 'should be true if in table', () => {
				setData( model, modelTable( [ [ '[]' ] ] ) );
				expect( command.isEnabled ).to.be.true;
			} );
		} );

		describe( 'execute()', () => {
			it( 'should insert column in given table at given index', () => {
				setData( model, modelTable( [
					[ '11[]', '12' ],
					[ '21', '22' ]
				] ) );

				command.execute();

				expect( formatTable( getData( model ) ) ).to.equal( formattedModelTable( [
					[ '11[]', '', '12' ],
					[ '21', '', '22' ]
				] ) );
			} );

			it( 'should insert columns at table end', () => {
				setData( model, modelTable( [
					[ '11', '12' ],
					[ '21', '22[]' ]
				] ) );

				command.execute();

				expect( formatTable( getData( model ) ) ).to.equal( formattedModelTable( [
					[ '11', '12', '' ],
					[ '21', '22[]', '' ]
				] ) );
			} );

			it( 'should update table heading columns attribute when inserting column in headings section', () => {
				setData( model, modelTable( [
					[ '11[]', '12' ],
					[ '21', '22' ],
					[ '31', '32' ]
				], { headingColumns: 2 } ) );

				command.execute();

				expect( formatTable( getData( model ) ) ).to.equal( formattedModelTable( [
					[ '11[]', '', '12' ],
					[ '21', '', '22' ],
					[ '31', '', '32' ]
				], { headingColumns: 3 } ) );
			} );

			it( 'should not update table heading columns attribute when inserting column after headings section', () => {
				setData( model, modelTable( [
					[ '11', '12[]', '13' ],
					[ '21', '22', '23' ],
					[ '31', '32', '33' ]
				], { headingColumns: 2 } ) );

				command.execute();

				expect( formatTable( getData( model ) ) ).to.equal( formattedModelTable( [
					[ '11', '12[]', '', '13' ],
					[ '21', '22', '', '23' ],
					[ '31', '32', '', '33' ]
				], { headingColumns: 2 } ) );
			} );

			it( 'should skip spanned columns', () => {
				setData( model, modelTable( [
					[ '11[]', '12' ],
					[ { colspan: 2, contents: '21' } ],
					[ '31', '32' ]
				], { headingColumns: 2 } ) );

				command.execute();

				expect( formatTable( getData( model ) ) ).to.equal( formattedModelTable( [
					[ '11[]', '', '12' ],
					[ { colspan: 3, contents: '21' } ],
					[ '31', '', '32' ]
				], { headingColumns: 3 } ) );
			} );

			it( 'should skip wide spanned columns', () => {
				setData( model, modelTable( [
					[ '11', '12[]', '13', '14', '15' ],
					[ '21', '22', { colspan: 2, contents: '23' }, '25' ],
					[ { colspan: 4, contents: '31' }, { colspan: 2, contents: '34' } ]
				], { headingColumns: 4 } ) );

				command.execute();

				expect( formatTable( getData( model ) ) ).to.equal( formattedModelTable( [
					[ '11', '12[]', '', '13', '14', '15' ],
					[ '21', '22', '', { colspan: 2, contents: '23' }, '25' ],
					[ { colspan: 5, contents: '31' }, { colspan: 2, contents: '34' } ]
				], { headingColumns: 5 } ) );
			} );
		} );
	} );

	describe( 'order=before', () => {
		beforeEach( () => {
			command = new InsertColumnCommand( editor, { order: 'before' } );
		} );

		describe( 'isEnabled', () => {
			it( 'should be false if wrong node', () => {
				setData( model, '<p>foo[]</p>' );
				expect( command.isEnabled ).to.be.false;
			} );

			it( 'should be true if in table', () => {
				setData( model, modelTable( [ [ '[]' ] ] ) );
				expect( command.isEnabled ).to.be.true;
			} );
		} );

		describe( 'execute()', () => {
			it( 'should insert column in given table at given index', () => {
				setData( model, modelTable( [
					[ '11', '12[]' ],
					[ '21', '22' ]
				] ) );

				command.execute();

				expect( formatTable( getData( model ) ) ).to.equal( formattedModelTable( [
					[ '11', '', '12[]' ],
					[ '21', '', '22' ]
				] ) );
			} );

			it( 'should insert columns at the table start', () => {
				setData( model, modelTable( [
					[ '11', '12' ],
					[ '[]21', '22' ]
				] ) );

				command.execute();

				expect( formatTable( getData( model ) ) ).to.equal( formattedModelTable( [
					[ '', '11', '12' ],
					[ '', '[]21', '22' ]
				] ) );
			} );

			it( 'should update table heading columns attribute when inserting column in headings section', () => {
				setData( model, modelTable( [
					[ '11', '12[]' ],
					[ '21', '22' ],
					[ '31', '32' ]
				], { headingColumns: 2 } ) );

				command.execute();

				expect( formatTable( getData( model ) ) ).to.equal( formattedModelTable( [
					[ '11', '', '12[]' ],
					[ '21', '', '22' ],
					[ '31', '', '32' ]
				], { headingColumns: 3 } ) );
			} );

			it( 'should not update table heading columns attribute when inserting column after headings section', () => {
				setData( model, modelTable( [
					[ '11', '12', '13[]' ],
					[ '21', '22', '23' ],
					[ '31', '32', '33' ]
				], { headingColumns: 2 } ) );

				command.execute();

				expect( formatTable( getData( model ) ) ).to.equal( formattedModelTable( [
					[ '11', '12', '', '13[]' ],
					[ '21', '22', '', '23' ],
					[ '31', '32', '', '33' ]
				], { headingColumns: 2 } ) );
			} );

			it( 'should skip spanned columns', () => {
				setData( model, modelTable( [
					[ '11', '12[]' ],
					[ { colspan: 2, contents: '21' } ],
					[ '31', '32' ]
				], { headingColumns: 2 } ) );

				command.execute();

				expect( formatTable( getData( model ) ) ).to.equal( formattedModelTable( [
					[ '11', '', '12[]' ],
					[ { colspan: 3, contents: '21' } ],
					[ '31', '', '32' ]
				], { headingColumns: 3 } ) );
			} );

			it( 'should skip wide spanned columns', () => {
				setData( model, modelTable( [
					[ '11', '12', '13[]', '14', '15' ],
					[ '21', '22', { colspan: 2, contents: '23' }, '25' ],
					[ { colspan: 4, contents: '31' }, { colspan: 2, contents: '34' } ]
				], { headingColumns: 4 } ) );

				command.execute();

				expect( formatTable( getData( model ) ) ).to.equal( formattedModelTable( [
					[ '11', '12', '', '13[]', '14', '15' ],
					[ '21', '22', '', { colspan: 2, contents: '23' }, '25' ],
					[ { colspan: 5, contents: '31' }, { colspan: 2, contents: '34' } ]
				], { headingColumns: 5 } ) );
			} );
		} );
	} );
} );
