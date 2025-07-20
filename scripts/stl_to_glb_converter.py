import bpy
import sys
import os
import bmesh

def clear_scene():
    """Clear all objects from the scene"""
    try:
        bpy.ops.object.select_all(action='SELECT')
        bpy.ops.object.delete(use_global=False)
    except Exception as e:
        print(f"Warning: Could not clear scene: {e}")

def convert_stl_to_glb(stl_path, glb_path):
    """Convert STL file to GLB format with enhanced error handling"""
    try:
        print(f"Starting conversion: {stl_path} -> {glb_path}")
        
        # Verify input file
        if not os.path.exists(stl_path):
            raise Exception(f"Input STL file not found: {stl_path}")
        
        input_size = os.path.getsize(stl_path)
        print(f"Input file size: {input_size} bytes")
        
        if input_size == 0:
            raise Exception("Input STL file is empty")
        
        # Clear existing scene
        print("Clearing scene...")
        clear_scene()
        
        # Import STL file with multiple fallback methods
        print("Importing STL file...")
        import_success = False
        
        # Method 1: Standard STL import
        try:
            bpy.ops.import_mesh.stl(filepath=stl_path)
            import_success = True
            print("STL imported using standard method")
        except Exception as e:
            print(f"Standard STL import failed: {e}")
            
            # Method 2: Try newer import method (Blender 3.0+)
            try:
                bpy.ops.wm.stl_import(filepath=stl_path)
                import_success = True
                print("STL imported using new method")
            except Exception as e2:
                print(f"New STL import method also failed: {e2}")
        
        if not import_success:
            raise Exception("All STL import methods failed")
        
        # Verify objects were imported
        imported_objects = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
        
        if not imported_objects:
            raise Exception("No mesh objects found after STL import")
        
        print(f"Successfully imported {len(imported_objects)} mesh object(s)")
        
        # Process each imported object (minimal processing to avoid issues)
        for i, obj in enumerate(imported_objects):
            try:
                print(f"Processing object {i+1}/{len(imported_objects)}: {obj.name}")
                
                # Select and make active
                bpy.context.view_layer.objects.active = obj
                obj.select_set(True)
                
                # Ensure object has a material (simple approach)
                if not obj.data.materials:
                    print(f"Adding material to {obj.name}")
                    mat = bpy.data.materials.new(name=f"Material_{i}")
                    mat.diffuse_color = (0.8, 0.8, 0.8, 1.0)
                    obj.data.materials.append(mat)
                
                print(f"Object {obj.name} processed successfully")
                
            except Exception as e:
                print(f"Warning: Error processing object {obj.name}: {e}")
                # Continue with other objects
        
        # Ensure output directory exists
        output_dir = os.path.dirname(glb_path)
        if output_dir and not os.path.exists(output_dir):
            os.makedirs(output_dir, exist_ok=True)
            print(f"Created output directory: {output_dir}")
        
        # Select all mesh objects for export
        bpy.ops.object.select_all(action='DESELECT')
        mesh_objects = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
        
        for obj in mesh_objects:
            obj.select_set(True)
        
        if not mesh_objects:
            raise Exception("No mesh objects available for export")
        
        print(f"Selected {len(mesh_objects)} objects for export")
        
        # Export as GLB with conservative settings
        print("Exporting to GLB...")
        export_success = False
        
        # Try full export first
        try:
            bpy.ops.export_scene.gltf(
                filepath=glb_path,
                export_format='GLB',
                use_selection=True,
                export_apply=True,
                export_materials='EXPORT',
                export_colors=True,
                export_normals=True,
                export_tangents=False,
                export_texcoords=True,
                export_animations=False,
                export_lights=False,
                export_cameras=False,
                export_extras=False,
                export_yup=True
            )
            export_success = True
            print("GLB export completed with full settings")
            
        except Exception as e:
            print(f"Full export failed: {e}")
            
            # Try minimal export as fallback
            try:
                print("Attempting minimal export...")
                bpy.ops.export_scene.gltf(
                    filepath=glb_path,
                    export_format='GLB',
                    use_selection=True,
                    export_apply=False,
                    export_materials='NONE',
                    export_colors=False,
                    export_normals=False,
                    export_animations=False,
                    export_lights=False,
                    export_cameras=False
                )
                export_success = True
                print("GLB export completed with minimal settings")
                
            except Exception as e2:
                print(f"Minimal export also failed: {e2}")
                raise Exception(f"All export methods failed: {e2}")
        
        if not export_success:
            raise Exception("Export operation did not complete")
        
        # Verify output file was created and has content
        if not os.path.exists(glb_path):
            raise Exception("GLB file was not created")
        
        output_size = os.path.getsize(glb_path)
        if output_size == 0:
            raise Exception("GLB file was created but is empty")
        
        if output_size < 100:
            raise Exception(f"GLB file is too small ({output_size} bytes) - likely corrupted")
        
        print(f"Successfully converted STL to GLB: {glb_path} ({output_size} bytes)")
        print(f"Conversion ratio: {input_size} -> {output_size} bytes")
        
        return True
        
    except Exception as e:
        print(f"CONVERSION FAILED: {str(e)}")
        import traceback
        traceback.print_exc()
        
        # Clean up partial files
        try:
            if os.path.exists(glb_path):
                os.remove(glb_path)
                print("Cleaned up partial output file")
        except:
            pass
            
        return False

def main():
    """Main function to handle command line arguments"""
    print("STL to GLB Converter - Starting...")
    print(f"Blender version: {bpy.app.version_string}")
    print(f"Python version: {sys.version}")
    
    # Disable TBB malloc replacement to avoid the error
    try:
        import os
        os.environ['TBB_MALLOC_DISABLE_REPLACEMENT'] = '1'
        print("Disabled TBB malloc replacement")
    except:
        pass
    
    print(f"All arguments: {sys.argv}")
    
    # Find arguments after '--'
    try:
        separator_index = sys.argv.index('--')
        script_args = sys.argv[separator_index + 1:]
        print(f"Script arguments: {script_args}")
    except ValueError:
        print("Error: Missing '--' separator in arguments")
        print("Usage: blender --background --python stl_to_glb_converter.py -- <input_stl> <output_glb>")
        sys.exit(1)
    
    if len(script_args) != 2:
        print(f"Error: Expected 2 arguments after '--', got {len(script_args)}")
        print("Usage: blender --background --python stl_to_glb_converter.py -- <input_stl> <output_glb>")
        sys.exit(1)
    
    stl_path = script_args[0]
    glb_path = script_args[1]
    
    print(f"Input STL: {stl_path}")
    print(f"Output GLB: {glb_path}")
    
    # Perform conversion
    success = convert_stl_to_glb(stl_path, glb_path)
    
    if success:
        print("Conversion completed successfully!")
        sys.exit(0)
    else:
        print("Conversion failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()
